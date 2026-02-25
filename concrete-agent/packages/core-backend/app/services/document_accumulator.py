"""
Document Accumulator Service

Handles incremental document processing with:
- Background task queue for non-blocking operations
- Hash-based caching to skip unchanged files
- Aggregated data collection across all project documents
- On-demand summary generation from accumulated data

Architecture:
- Files are tracked by content hash (SHA256)
- Changed files trigger re-parsing only
- Parsed data is cached in project_cache
- Summary is generated from aggregated cache

Author: STAVAGENT Team
Version: 1.0.0
Date: 2025-12-28
"""

import asyncio
import hashlib
import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set
import logging

logger = logging.getLogger(__name__)


class FileStatus(str, Enum):
    """Status of a file in the accumulator."""
    PENDING = "pending"           # Queued for processing
    SCANNING = "scanning"         # Being scanned (hash calculation)
    PARSING = "parsing"           # Being parsed
    PARSED = "parsed"             # Successfully parsed
    ERROR = "error"               # Failed to parse
    SKIPPED = "skipped"           # Unchanged (hash match)


class FolderSyncStatus(str, Enum):
    """Status of folder synchronization."""
    IDLE = "idle"
    SCANNING = "scanning"
    SYNCING = "syncing"
    COMPLETE = "complete"
    ERROR = "error"


class TaskStatus(str, Enum):
    """Status of a background task."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ParsedFileData:
    """Parsed data from a single file."""
    file_id: str
    file_name: str
    file_type: str
    content_hash: str
    parsed_at: datetime
    positions: List[Dict[str, Any]] = field(default_factory=list)
    requirements: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'parsed_at': self.parsed_at.isoformat()
        }


@dataclass
class ProjectFile:
    """A file tracked in the project."""
    file_id: str
    project_id: str
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    content_hash: str
    status: FileStatus
    created_at: datetime
    updated_at: datetime
    parsed_data: Optional[ParsedFileData] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'file_id': self.file_id,
            'project_id': self.project_id,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'content_hash': self.content_hash,
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'error_message': self.error_message,
        }
        if self.parsed_data:
            result['parsed_data'] = self.parsed_data.to_dict()
        return result


@dataclass
class FolderLink:
    """A linked folder for automatic sync."""
    folder_id: str
    project_id: str
    folder_path: str
    folder_type: str  # 'local', 'google_drive', 'sharepoint'
    last_sync: Optional[datetime]
    sync_status: FolderSyncStatus
    file_count: int
    created_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            'folder_id': self.folder_id,
            'project_id': self.project_id,
            'folder_path': self.folder_path,
            'folder_type': self.folder_type,
            'last_sync': self.last_sync.isoformat() if self.last_sync else None,
            'sync_status': self.sync_status.value,
            'file_count': self.file_count,
            'created_at': self.created_at.isoformat(),
        }


@dataclass
class ProjectCache:
    """Aggregated cache for a project."""
    project_id: str
    aggregated_positions: List[Dict[str, Any]] = field(default_factory=list)
    aggregated_requirements: List[Dict[str, Any]] = field(default_factory=list)
    file_versions: Dict[str, str] = field(default_factory=dict)  # file_id -> hash
    last_summary: Optional[Dict[str, Any]] = None
    summary_generated_at: Optional[datetime] = None
    cache_valid: bool = True
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'project_id': self.project_id,
            'aggregated_positions': self.aggregated_positions,
            'aggregated_requirements': self.aggregated_requirements,
            'file_versions': self.file_versions,
            'last_summary': self.last_summary,
            'summary_generated_at': self.summary_generated_at.isoformat() if self.summary_generated_at else None,
            'cache_valid': self.cache_valid,
            'updated_at': self.updated_at.isoformat(),
            'positions_count': len(self.aggregated_positions),
            'files_count': len(self.file_versions),
        }


@dataclass
class BackgroundTask:
    """A background task in the queue."""
    task_id: str
    task_type: str  # 'scan_folder', 'parse_file', 'generate_summary'
    project_id: str
    status: TaskStatus
    progress: float  # 0.0 - 1.0
    message: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'task_id': self.task_id,
            'task_type': self.task_type,
            'project_id': self.project_id,
            'status': self.status.value,
            'progress': self.progress,
            'message': self.message,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'result': self.result,
            'error': self.error,
        }


@dataclass
class ProjectVersion:
    """A snapshot of project state at a point in time."""
    version_id: str
    project_id: str
    version_number: int  # Auto-incrementing version number
    created_at: datetime
    summary: Dict[str, Any]  # The generated summary
    positions_count: int
    files_count: int
    file_versions: Dict[str, str]  # file_id -> hash at this version
    metadata: Dict[str, Any] = field(default_factory=dict)  # User notes, tags, etc.

    def to_dict(self) -> Dict[str, Any]:
        return {
            'version_id': self.version_id,
            'project_id': self.project_id,
            'version_number': self.version_number,
            'created_at': self.created_at.isoformat(),
            'summary': self.summary,
            'positions_count': self.positions_count,
            'files_count': self.files_count,
            'file_versions': self.file_versions,
            'metadata': self.metadata,
        }


class DocumentAccumulator:
    """
    Main service for document accumulation and background processing.

    Features:
    - Non-blocking file processing via background tasks
    - Hash-based caching (skip unchanged files)
    - Incremental updates (only process changed files)
    - Aggregated data collection
    - On-demand summary generation
    """

    # Supported file extensions
    SUPPORTED_EXTENSIONS = {'.xlsx', '.xls', '.pdf', '.xml', '.csv', '.json'}

    # Maximum parallel workers for parsing
    MAX_WORKERS = 4

    def __init__(
        self,
        parser_func: Optional[Callable] = None,
        summary_func: Optional[Callable] = None,
        progress_callback: Optional[Callable] = None,
    ):
        """
        Initialize the document accumulator.

        Args:
            parser_func: Function to parse a file (file_path) -> ParsedFileData
            summary_func: Function to generate summary (positions, requirements) -> summary
            progress_callback: Callback for progress updates (task_id, progress, message)
        """
        self._parser_func = parser_func
        self._summary_func = summary_func
        self._progress_callback = progress_callback

        # In-memory storage (replace with database in production)
        self._projects: Dict[str, Dict[str, Any]] = {}
        self._files: Dict[str, ProjectFile] = {}
        self._folders: Dict[str, FolderLink] = {}
        self._caches: Dict[str, ProjectCache] = {}
        self._tasks: Dict[str, BackgroundTask] = {}
        self._versions: Dict[str, List[ProjectVersion]] = {}  # project_id -> list of versions

        # Background task queue
        self._task_queue: asyncio.Queue = asyncio.Queue()
        self._executor = ThreadPoolExecutor(max_workers=self.MAX_WORKERS)
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None

        # Subscribers for real-time updates
        self._subscribers: Dict[str, Set[Callable]] = {}

    async def start(self):
        """Start the background worker."""
        if self._running:
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._background_worker())
        logger.info("DocumentAccumulator background worker started")

    async def stop(self):
        """Stop the background worker."""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        self._executor.shutdown(wait=False)
        logger.info("DocumentAccumulator background worker stopped")

    async def _background_worker(self):
        """Process tasks from the queue."""
        while self._running:
            try:
                # Wait for a task with timeout
                try:
                    task = await asyncio.wait_for(
                        self._task_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Process the task
                await self._process_task(task)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Background worker error: {e}")

    async def _process_task(self, task: BackgroundTask):
        """Process a single background task."""
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        await self._notify_subscribers(task.project_id, 'task_started', task.to_dict())

        try:
            if task.task_type == 'scan_folder':
                await self._execute_scan_folder(task)
            elif task.task_type == 'parse_file':
                await self._execute_parse_file(task)
            elif task.task_type == 'parse_all':
                await self._execute_parse_all(task)
            elif task.task_type == 'generate_summary':
                await self._execute_generate_summary(task)
            else:
                raise ValueError(f"Unknown task type: {task.task_type}")

            task.status = TaskStatus.COMPLETE
            task.completed_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Task {task.task_id} failed: {e}")
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.utcnow()

        await self._notify_subscribers(task.project_id, 'task_completed', task.to_dict())

    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of file content."""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _get_file_type(self, file_path: str) -> str:
        """Get file type from extension."""
        ext = Path(file_path).suffix.lower()
        type_map = {
            '.xlsx': 'excel',
            '.xls': 'excel',
            '.pdf': 'pdf',
            '.xml': 'xml',
            '.csv': 'csv',
            '.json': 'json',
        }
        return type_map.get(ext, 'unknown')

    async def _execute_scan_folder(self, task: BackgroundTask):
        """Scan a folder and discover files."""
        folder_id = task.result.get('folder_id') if task.result else None
        folder = self._folders.get(folder_id)

        if not folder:
            raise ValueError(f"Folder {folder_id} not found")

        folder.sync_status = FolderSyncStatus.SCANNING
        folder_path = Path(folder.folder_path)

        if not folder_path.exists():
            raise ValueError(f"Folder does not exist: {folder_path}")

        # Discover files
        discovered_files = []
        for ext in self.SUPPORTED_EXTENSIONS:
            discovered_files.extend(folder_path.rglob(f'*{ext}'))

        total_files = len(discovered_files)
        task.message = f"Found {total_files} files"
        task.progress = 0.1
        await self._notify_subscribers(task.project_id, 'task_progress', task.to_dict())

        # Process each file
        new_files = 0
        changed_files = 0
        unchanged_files = 0

        for i, file_path in enumerate(discovered_files):
            file_path_str = str(file_path)

            # Calculate hash
            content_hash = await asyncio.get_event_loop().run_in_executor(
                self._executor,
                self._calculate_file_hash,
                file_path_str
            )

            # Check if file exists and is unchanged
            existing_file = self._find_file_by_path(task.project_id, file_path_str)

            if existing_file:
                if existing_file.content_hash == content_hash:
                    # Unchanged - skip
                    existing_file.status = FileStatus.SKIPPED
                    unchanged_files += 1
                else:
                    # Changed - mark for re-parsing
                    existing_file.content_hash = content_hash
                    existing_file.status = FileStatus.PENDING
                    existing_file.updated_at = datetime.utcnow()
                    changed_files += 1
            else:
                # New file
                new_file = ProjectFile(
                    file_id=str(uuid.uuid4()),
                    project_id=task.project_id,
                    file_name=file_path.name,
                    file_path=file_path_str,
                    file_type=self._get_file_type(file_path_str),
                    file_size=file_path.stat().st_size,
                    content_hash=content_hash,
                    status=FileStatus.PENDING,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                self._files[new_file.file_id] = new_file
                new_files += 1

            # Update progress
            task.progress = 0.1 + 0.9 * (i + 1) / total_files
            task.message = f"Scanned {i + 1}/{total_files} files"

            if (i + 1) % 10 == 0:  # Notify every 10 files
                await self._notify_subscribers(task.project_id, 'task_progress', task.to_dict())

        # Update folder status
        folder.sync_status = FolderSyncStatus.COMPLETE
        folder.last_sync = datetime.utcnow()
        folder.file_count = total_files

        # Invalidate cache if files changed
        if new_files > 0 or changed_files > 0:
            cache = self._get_or_create_cache(task.project_id)
            cache.cache_valid = False

        task.result = {
            'folder_id': folder_id,
            'total_files': total_files,
            'new_files': new_files,
            'changed_files': changed_files,
            'unchanged_files': unchanged_files,
            'needs_parsing': new_files + changed_files,
        }
        task.progress = 1.0
        task.message = f"Scan complete: {new_files} new, {changed_files} changed, {unchanged_files} unchanged"

    async def _execute_parse_file(self, task: BackgroundTask):
        """Parse a single file."""
        file_id = task.result.get('file_id') if task.result else None
        file = self._files.get(file_id)

        if not file:
            raise ValueError(f"File {file_id} not found")

        file.status = FileStatus.PARSING
        task.message = f"Parsing {file.file_name}"

        try:
            # Parse file (run in executor to not block)
            if self._parser_func:
                parsed_data = await asyncio.get_event_loop().run_in_executor(
                    self._executor,
                    self._parser_func,
                    file.file_path
                )
            else:
                # Default: create empty parsed data
                parsed_data = ParsedFileData(
                    file_id=file.file_id,
                    file_name=file.file_name,
                    file_type=file.file_type,
                    content_hash=file.content_hash,
                    parsed_at=datetime.utcnow(),
                )

            file.parsed_data = parsed_data
            file.status = FileStatus.PARSED
            file.updated_at = datetime.utcnow()

            # Update cache
            await self._update_cache_with_file(file)

            task.result = {
                'file_id': file_id,
                'positions_count': len(parsed_data.positions),
                'requirements_count': len(parsed_data.requirements),
            }
            task.progress = 1.0
            task.message = f"Parsed {file.file_name}: {len(parsed_data.positions)} positions"

        except Exception as e:
            file.status = FileStatus.ERROR
            file.error_message = str(e)
            raise

    async def _execute_parse_all(self, task: BackgroundTask):
        """Parse all pending files in a project."""
        project_id = task.project_id

        # Get all pending files
        pending_files = [
            f for f in self._files.values()
            if f.project_id == project_id and f.status == FileStatus.PENDING
        ]

        total = len(pending_files)
        if total == 0:
            task.result = {'parsed': 0, 'skipped': 0, 'errors': 0}
            task.message = "No files to parse"
            task.progress = 1.0
            return

        parsed = 0
        errors = 0

        # Parse files in parallel batches
        for i, file in enumerate(pending_files):
            try:
                file.status = FileStatus.PARSING

                if self._parser_func:
                    parsed_data = await asyncio.get_event_loop().run_in_executor(
                        self._executor,
                        self._parser_func,
                        file.file_path
                    )
                else:
                    parsed_data = ParsedFileData(
                        file_id=file.file_id,
                        file_name=file.file_name,
                        file_type=file.file_type,
                        content_hash=file.content_hash,
                        parsed_at=datetime.utcnow(),
                    )

                file.parsed_data = parsed_data
                file.status = FileStatus.PARSED
                file.updated_at = datetime.utcnow()
                parsed += 1

            except Exception as e:
                file.status = FileStatus.ERROR
                file.error_message = str(e)
                errors += 1
                logger.error(f"Failed to parse {file.file_name}: {e}")

            # Update progress
            task.progress = (i + 1) / total
            task.message = f"Parsed {i + 1}/{total} files ({errors} errors)"

            if (i + 1) % 5 == 0:
                await self._notify_subscribers(project_id, 'task_progress', task.to_dict())

        # Rebuild cache
        await self._rebuild_cache(project_id)

        task.result = {
            'parsed': parsed,
            'errors': errors,
            'total': total,
        }
        task.progress = 1.0
        task.message = f"Complete: {parsed} parsed, {errors} errors"

    async def _execute_generate_summary(self, task: BackgroundTask):
        """Generate summary from accumulated data."""
        project_id = task.project_id
        language = task.result.get('language', 'cs') if task.result else 'cs'

        cache = self._get_or_create_cache(project_id)

        if not cache.aggregated_positions:
            raise ValueError("No positions to summarize. Parse files first.")

        task.message = f"Generating summary for {len(cache.aggregated_positions)} positions"
        task.progress = 0.3
        await self._notify_subscribers(project_id, 'task_progress', task.to_dict())

        # Generate summary — use SummaryGenerator (Multi-Role AI) with fallback
        summary: dict
        try:
            from app.services.summary_generator import (
                SummaryGenerator,
                SummaryLanguage,
                SummaryFormat,
            )
            lang_enum = SummaryLanguage(language) if language in ('cs', 'en', 'sk') else SummaryLanguage.CZECH
            project_name = (task.result or {}).get('project_name') or project_id

            generator = SummaryGenerator()
            project_summary = await generator.generate_summary(
                project_id=project_id,
                project_name=project_name,
                positions=cache.aggregated_positions,
                audit_results=cache.aggregated_requirements or None,
                language=lang_enum,
                output_format=SummaryFormat.JSON,
                use_parallel=True,
            )
            summary = project_summary.to_dict()
            logger.info(f"[Accumulator] SummaryGenerator OK — {len(cache.aggregated_positions)} positions")
        except Exception as gen_err:
            logger.warning(f"[Accumulator] SummaryGenerator failed: {gen_err} — using basic fallback")
            summary = {
                'executive_summary': (
                    f"Projekt obsahuje {len(cache.aggregated_positions)} pozic "
                    f"z {len(cache.file_versions)} souborů."
                ),
                'key_findings': [],
                'recommendations': [],
                'critical_issues': [],
                'warnings': [],
                'overall_status': 'AMBER',
                'confidence_score': 0.0,
                'generated_at': datetime.utcnow().isoformat(),
            }

        cache.last_summary = summary
        cache.summary_generated_at = datetime.utcnow()
        cache.cache_valid = True
        cache.updated_at = datetime.utcnow()

        # Create version snapshot
        version = self._create_version_snapshot(project_id, summary, cache)

        task.result = {
            'summary': summary,
            'positions_count': len(cache.aggregated_positions),
            'files_count': len(cache.file_versions),
            'version_id': version.version_id,
            'version_number': version.version_number,
        }
        task.progress = 1.0
        task.message = f"Summary generated (version {version.version_number})"

    async def _update_cache_with_file(self, file: ProjectFile):
        """Update project cache with parsed file data."""
        if not file.parsed_data:
            return

        cache = self._get_or_create_cache(file.project_id)

        # Remove old data from this file
        cache.aggregated_positions = [
            p for p in cache.aggregated_positions
            if p.get('_source_file_id') != file.file_id
        ]
        cache.aggregated_requirements = [
            r for r in cache.aggregated_requirements
            if r.get('_source_file_id') != file.file_id
        ]

        # Add new data with source tracking
        for pos in file.parsed_data.positions:
            pos['_source_file_id'] = file.file_id
            pos['_source_file_name'] = file.file_name
            cache.aggregated_positions.append(pos)

        for req in file.parsed_data.requirements:
            req['_source_file_id'] = file.file_id
            req['_source_file_name'] = file.file_name
            cache.aggregated_requirements.append(req)

        # Update file version
        cache.file_versions[file.file_id] = file.content_hash
        cache.cache_valid = False  # Summary needs regeneration
        cache.updated_at = datetime.utcnow()

    async def _rebuild_cache(self, project_id: str):
        """Rebuild entire cache from all parsed files."""
        cache = self._get_or_create_cache(project_id)
        cache.aggregated_positions = []
        cache.aggregated_requirements = []
        cache.file_versions = {}

        for file in self._files.values():
            if file.project_id == project_id and file.status == FileStatus.PARSED and file.parsed_data:
                for pos in file.parsed_data.positions:
                    pos['_source_file_id'] = file.file_id
                    pos['_source_file_name'] = file.file_name
                    cache.aggregated_positions.append(pos)

                for req in file.parsed_data.requirements:
                    req['_source_file_id'] = file.file_id
                    req['_source_file_name'] = file.file_name
                    cache.aggregated_requirements.append(req)

                cache.file_versions[file.file_id] = file.content_hash

        cache.cache_valid = False
        cache.updated_at = datetime.utcnow()

    def _get_or_create_cache(self, project_id: str) -> ProjectCache:
        """Get or create project cache."""
        if project_id not in self._caches:
            self._caches[project_id] = ProjectCache(project_id=project_id)
        return self._caches[project_id]

    def _find_file_by_path(self, project_id: str, file_path: str) -> Optional[ProjectFile]:
        """Find file by path in project."""
        for file in self._files.values():
            if file.project_id == project_id and file.file_path == file_path:
                return file
        return None

    def _create_version_snapshot(
        self,
        project_id: str,
        summary: Dict[str, Any],
        cache: ProjectCache,
    ) -> ProjectVersion:
        """Create a version snapshot of the current project state."""
        if project_id not in self._versions:
            self._versions[project_id] = []

        # Auto-increment version number
        version_number = len(self._versions[project_id]) + 1

        version = ProjectVersion(
            version_id=str(uuid.uuid4()),
            project_id=project_id,
            version_number=version_number,
            created_at=datetime.utcnow(),
            summary=summary,
            positions_count=len(cache.aggregated_positions),
            files_count=len(cache.file_versions),
            file_versions=cache.file_versions.copy(),  # Deep copy
            metadata={},
        )

        self._versions[project_id].append(version)
        logger.info(f"Created version snapshot {version_number} for project {project_id}")

        return version

    def _compare_summaries(
        self,
        from_summary: Dict[str, Any],
        to_summary: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Compare two summaries and return differences."""
        comparison = {
            'executive_summary_changed': from_summary.get('executive_summary') != to_summary.get('executive_summary'),
            'key_findings_delta': [],
            'recommendations_delta': [],
        }

        # Compare key findings
        from_findings = set(from_summary.get('key_findings', []))
        to_findings = set(to_summary.get('key_findings', []))

        comparison['key_findings_delta'] = {
            'added': list(to_findings - from_findings),
            'removed': list(from_findings - to_findings),
        }

        # Compare recommendations
        from_recommendations = set(from_summary.get('recommendations', []))
        to_recommendations = set(to_summary.get('recommendations', []))

        comparison['recommendations_delta'] = {
            'added': list(to_recommendations - from_recommendations),
            'removed': list(from_recommendations - to_recommendations),
        }

        return comparison

    # ==================== Public API ====================

    async def add_folder(self, project_id: str, folder_path: str, folder_type: str = 'local') -> FolderLink:
        """
        Add a folder link to the project.
        Returns immediately, scanning happens in background.
        """
        folder = FolderLink(
            folder_id=str(uuid.uuid4()),
            project_id=project_id,
            folder_path=folder_path,
            folder_type=folder_type,
            last_sync=None,
            sync_status=FolderSyncStatus.IDLE,
            file_count=0,
            created_at=datetime.utcnow(),
        )
        self._folders[folder.folder_id] = folder

        # Queue scan task
        await self.queue_scan_folder(project_id, folder.folder_id)

        return folder

    async def add_file(self, project_id: str, file_path: str, content: Optional[bytes] = None) -> ProjectFile:
        """
        Add a single file to the project.
        If content is provided, save it first.
        """
        path = Path(file_path)

        if content:
            # Save content to file
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, 'wb') as f:
                f.write(content)

        if not path.exists():
            raise ValueError(f"File does not exist: {file_path}")

        content_hash = self._calculate_file_hash(file_path)

        # Check for existing file
        existing = self._find_file_by_path(project_id, file_path)
        if existing:
            if existing.content_hash == content_hash:
                existing.status = FileStatus.SKIPPED
                return existing
            else:
                existing.content_hash = content_hash
                existing.status = FileStatus.PENDING
                existing.updated_at = datetime.utcnow()
                return existing

        # Create new file
        file = ProjectFile(
            file_id=str(uuid.uuid4()),
            project_id=project_id,
            file_name=path.name,
            file_path=file_path,
            file_type=self._get_file_type(file_path),
            file_size=path.stat().st_size,
            content_hash=content_hash,
            status=FileStatus.PENDING,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self._files[file.file_id] = file

        # Invalidate cache
        cache = self._get_or_create_cache(project_id)
        cache.cache_valid = False

        return file

    async def queue_scan_folder(self, project_id: str, folder_id: str) -> BackgroundTask:
        """Queue a folder scan task."""
        task = BackgroundTask(
            task_id=str(uuid.uuid4()),
            task_type='scan_folder',
            project_id=project_id,
            status=TaskStatus.QUEUED,
            progress=0.0,
            message='Queued for scanning',
            created_at=datetime.utcnow(),
            result={'folder_id': folder_id},
        )
        self._tasks[task.task_id] = task
        await self._task_queue.put(task)
        return task

    async def queue_parse_file(self, project_id: str, file_id: str) -> BackgroundTask:
        """Queue a file parse task."""
        task = BackgroundTask(
            task_id=str(uuid.uuid4()),
            task_type='parse_file',
            project_id=project_id,
            status=TaskStatus.QUEUED,
            progress=0.0,
            message='Queued for parsing',
            created_at=datetime.utcnow(),
            result={'file_id': file_id},
        )
        self._tasks[task.task_id] = task
        await self._task_queue.put(task)
        return task

    async def queue_parse_all(self, project_id: str) -> BackgroundTask:
        """Queue parsing of all pending files."""
        task = BackgroundTask(
            task_id=str(uuid.uuid4()),
            task_type='parse_all',
            project_id=project_id,
            status=TaskStatus.QUEUED,
            progress=0.0,
            message='Queued for parsing all files',
            created_at=datetime.utcnow(),
        )
        self._tasks[task.task_id] = task
        await self._task_queue.put(task)
        return task

    async def queue_generate_summary(
        self,
        project_id: str,
        language: str = 'cs',
        project_name: str = '',
    ) -> BackgroundTask:
        """Queue summary generation."""
        task = BackgroundTask(
            task_id=str(uuid.uuid4()),
            task_type='generate_summary',
            project_id=project_id,
            status=TaskStatus.QUEUED,
            progress=0.0,
            message='Queued for summary generation',
            created_at=datetime.utcnow(),
            result={'language': language, 'project_name': project_name or project_id},
        )
        self._tasks[task.task_id] = task
        await self._task_queue.put(task)
        return task

    def get_task_status(self, task_id: str) -> Optional[BackgroundTask]:
        """Get status of a background task."""
        return self._tasks.get(task_id)

    def get_project_files(self, project_id: str) -> List[ProjectFile]:
        """Get all files in a project."""
        return [f for f in self._files.values() if f.project_id == project_id]

    def get_project_folders(self, project_id: str) -> List[FolderLink]:
        """Get all folders in a project."""
        return [f for f in self._folders.values() if f.project_id == project_id]

    def get_project_cache(self, project_id: str) -> Optional[ProjectCache]:
        """Get project cache."""
        return self._caches.get(project_id)

    def get_project_tasks(self, project_id: str) -> List[BackgroundTask]:
        """Get all tasks for a project."""
        return [t for t in self._tasks.values() if t.project_id == project_id]

    def get_project_summary(self, project_id: str) -> Dict[str, Any]:
        """Get current project summary and status."""
        files = self.get_project_files(project_id)
        folders = self.get_project_folders(project_id)
        cache = self.get_project_cache(project_id)
        active_tasks = [t for t in self.get_project_tasks(project_id)
                       if t.status in (TaskStatus.QUEUED, TaskStatus.RUNNING)]

        return {
            'project_id': project_id,
            'files': {
                'total': len(files),
                'pending': len([f for f in files if f.status == FileStatus.PENDING]),
                'parsing': len([f for f in files if f.status == FileStatus.PARSING]),
                'parsed': len([f for f in files if f.status == FileStatus.PARSED]),
                'errors': len([f for f in files if f.status == FileStatus.ERROR]),
                'skipped': len([f for f in files if f.status == FileStatus.SKIPPED]),
            },
            'folders': {
                'total': len(folders),
                'syncing': len([f for f in folders if f.sync_status == FolderSyncStatus.SYNCING]),
            },
            'cache': cache.to_dict() if cache else None,
            'active_tasks': [t.to_dict() for t in active_tasks],
            'has_pending_work': len(active_tasks) > 0 or any(f.status == FileStatus.PENDING for f in files),
        }

    def get_project_versions(self, project_id: str) -> List[ProjectVersion]:
        """Get all versions for a project, sorted by version number (newest first)."""
        versions = self._versions.get(project_id, [])
        return sorted(versions, key=lambda v: v.version_number, reverse=True)

    def get_version(self, project_id: str, version_id: str) -> Optional[ProjectVersion]:
        """Get a specific version by ID."""
        versions = self._versions.get(project_id, [])
        for version in versions:
            if version.version_id == version_id:
                return version
        return None

    def compare_versions(
        self,
        project_id: str,
        from_version_id: str,
        to_version_id: str,
    ) -> Dict[str, Any]:
        """
        Compare two versions of a project.

        Returns:
            - files_added: List of file IDs added
            - files_removed: List of file IDs removed
            - files_modified: List of file IDs with changed hashes
            - positions_delta: Change in positions count
            - cost_delta: Change in cost (if available)
            - summary_comparison: Diff of summaries
        """
        from_version = self.get_version(project_id, from_version_id)
        to_version = self.get_version(project_id, to_version_id)

        if not from_version or not to_version:
            raise ValueError("One or both versions not found")

        # Compare file versions
        from_files = set(from_version.file_versions.keys())
        to_files = set(to_version.file_versions.keys())

        files_added = list(to_files - from_files)
        files_removed = list(from_files - to_files)
        files_modified = [
            file_id for file_id in (from_files & to_files)
            if from_version.file_versions[file_id] != to_version.file_versions[file_id]
        ]

        # Compare positions count
        positions_delta = to_version.positions_count - from_version.positions_count

        # Compare summaries
        summary_comparison = self._compare_summaries(
            from_version.summary,
            to_version.summary,
        )

        # Extract cost if available
        from_cost = from_version.summary.get('cost_analysis', {}).get('total_cost')
        to_cost = to_version.summary.get('cost_analysis', {}).get('total_cost')
        cost_delta = (to_cost - from_cost) if (from_cost and to_cost) else None

        # Get risk assessment change
        from_risk = from_version.summary.get('risk_assessment', 'UNKNOWN')
        to_risk = to_version.summary.get('risk_assessment', 'UNKNOWN')

        return {
            'from_version': {
                'version_id': from_version.version_id,
                'version_number': from_version.version_number,
                'created_at': from_version.created_at.isoformat(),
                'positions_count': from_version.positions_count,
                'files_count': from_version.files_count,
            },
            'to_version': {
                'version_id': to_version.version_id,
                'version_number': to_version.version_number,
                'created_at': to_version.created_at.isoformat(),
                'positions_count': to_version.positions_count,
                'files_count': to_version.files_count,
            },
            'files_added': files_added,
            'files_removed': files_removed,
            'files_modified': files_modified,
            'positions_delta': positions_delta,
            'cost_delta': cost_delta,
            'risk_change': f"{from_risk} → {to_risk}" if from_risk != to_risk else f"{from_risk} (unchanged)",
            'summary_comparison': summary_comparison,
        }

    def export_to_excel(self, project_id: str, project_name: str) -> bytes:
        """Export project data to Excel."""
        from app.services.export_service import get_export_service

        cache = self.get_project_cache(project_id)
        if not cache:
            raise ValueError("No data available for export")

        export_service = get_export_service()
        return export_service.export_to_excel(
            project_name=project_name,
            positions=cache.aggregated_positions,
            summary=cache.last_summary,
        )

    def export_summary_to_pdf(
        self,
        project_id: str,
        project_name: str,
        version_id: Optional[str] = None,
    ) -> bytes:
        """Export project summary to PDF. Optionally specify a version."""
        from app.services.export_service import get_export_service

        summary = None
        metadata = {}

        if version_id:
            # Export specific version
            version = self.get_version(project_id, version_id)
            if not version:
                raise ValueError(f"Version {version_id} not found")
            summary = version.summary
            metadata = {
                'version_number': version.version_number,
                'positions_count': version.positions_count,
                'created_at': version.created_at.isoformat(),
            }
        else:
            # Export current summary
            cache = self.get_project_cache(project_id)
            if not cache or not cache.last_summary:
                raise ValueError("No summary available for export")
            summary = cache.last_summary
            metadata = {
                'positions_count': len(cache.aggregated_positions),
                'files_count': len(cache.file_versions),
            }

        export_service = get_export_service()
        return export_service.export_summary_to_pdf(
            project_name=project_name,
            summary=summary,
            metadata=metadata,
        )

    # ==================== Subscriptions ====================

    def subscribe(self, project_id: str, callback: Callable):
        """Subscribe to project updates."""
        if project_id not in self._subscribers:
            self._subscribers[project_id] = set()
        self._subscribers[project_id].add(callback)

    def unsubscribe(self, project_id: str, callback: Callable):
        """Unsubscribe from project updates."""
        if project_id in self._subscribers:
            self._subscribers[project_id].discard(callback)

    async def _notify_subscribers(self, project_id: str, event_type: str, data: Dict[str, Any]):
        """Notify all subscribers of an event."""
        if project_id in self._subscribers:
            for callback in self._subscribers[project_id]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event_type, data)
                    else:
                        callback(event_type, data)
                except Exception as e:
                    logger.error(f"Subscriber callback error: {e}")


# Singleton instance
_accumulator: Optional[DocumentAccumulator] = None


def get_accumulator() -> DocumentAccumulator:
    """Get the singleton accumulator instance."""
    global _accumulator
    if _accumulator is None:
        _accumulator = DocumentAccumulator()
    return _accumulator


async def initialize_accumulator(
    parser_func: Optional[Callable] = None,
    summary_func: Optional[Callable] = None,
) -> DocumentAccumulator:
    """Initialize and start the accumulator."""
    global _accumulator
    _accumulator = DocumentAccumulator(
        parser_func=parser_func,
        summary_func=summary_func,
    )
    await _accumulator.start()
    return _accumulator
