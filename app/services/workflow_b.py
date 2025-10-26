"""
Workflow B: Generate estimate from technical drawings
Workflow B - Генерация сметы из чертежей (без готового выказа)
"""
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from app.core.claude_client import ClaudeClient
from app.core.gpt4_client import GPT4VisionClient
from app.core.config import settings, ArtifactPaths

# ✅ ДОБАВЛЕНО: SmartParser для документации
from app.parsers import SmartParser
from app.state.project_store import project_store

logger = logging.getLogger(__name__)


class WorkflowB:
    """
    Workflow B: Нет выказа, есть только чертежи
    
    Workflow:
    1. Upload → Только документация + чертежи
    2. GPT-4V анализ чертежей → размеры, объемы (ПЛАТНО)
    3. Calculate материалы → бетон, арматура, опалубка (БЕСПЛАТНО)
    4. Claude генерация позиций → создание выказа (ПЛАТНО)
    5. AUDIT генерированных → как в Workflow A (ПЛАТНО)
    6. Generate отчет + Tech Card (БЕСПЛАТНО)
    """
    
    def __init__(self):
        """Initialize Workflow B services"""
        self.claude = ClaudeClient()
        self.gpt4v = GPT4VisionClient() if settings.ENABLE_WORKFLOW_B else None
        
        # ✅ ДОБАВЛЕНО: SmartParser для обработки документации
        self.smart_parser = SmartParser()
        
        if not self.gpt4v:
            logger.warning("GPT-4 Vision not available. Workflow B limited.")
    
    async def process_drawings(
        self,
        drawings: List[Path],
        documentation: Optional[List[Path]] = None,
        project_name: str = "Unnamed Project"
    ) -> Dict[str, Any]:
        """
        Process construction drawings and generate estimate
        
        Args:
            drawings: List of drawing files (PDF/images)
            documentation: Optional technical documentation (PDF/Excel/XML/TXT)
            project_name: Project name
            
        Returns:
            Dict with generated estimate:
            {
                "generated_positions": List[Dict],
                "drawing_analysis": List[Dict],
                "calculations": Dict,
                "tech_card": Dict
            }
        """
        logger.info(f"Workflow B: Processing {len(drawings)} drawings for '{project_name}'")
        
        try:
            # Step 1: Analyze drawings with GPT-4V (ПЛАТНО)
            logger.info("Step 1: Analyzing drawings with GPT-4 Vision...")
            drawing_analysis = await self._analyze_drawings(drawings)
            
            # Step 2: Calculate materials (БЕСПЛАТНО)
            logger.info("Step 2: Calculating materials...")
            calculations = self._calculate_materials(drawing_analysis)
            
            # Step 3: Generate positions with Claude (ПЛАТНО)
            logger.info("Step 3: Generating positions with Claude...")
            positions = await self._generate_positions(
                drawing_analysis,
                calculations,
                documentation
            )
            
            # Step 4: Create technical card (БЕСПЛАТНО)
            logger.info("Step 4: Creating technical card...")
            tech_card = self._create_tech_card(
                project_name,
                drawing_analysis,
                calculations
            )
            
            result = {
                "success": True,
                "project_name": project_name,
                "generated_positions": positions,
                "drawing_analysis": drawing_analysis,
                "calculations": calculations,
                "tech_card": tech_card,
                "total_positions": len(positions)
            }
            
            logger.info(f"✅ Workflow B complete: Generated {len(positions)} positions")
            return result
            
        except Exception as e:
            logger.error(f"Workflow B failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "project_name": project_name
            }
    
    async def _analyze_drawings(self, drawings: List[Path]) -> List[Dict[str, Any]]:
        """
        Analyze drawings with GPT-4 Vision (ПЛАТНО)
        
        Returns:
            List of analyzed drawing data:
            [{
                "drawing_file": str,
                "elements": List[Dict],
                "dimensions": Dict,
                "materials": Dict,
                "notes": str
            }, ...]
        """
        if not self.gpt4v:
            raise ValueError("GPT-4 Vision not available")
        
        analysis_results = []
        
        for drawing in drawings:
            logger.info(f"  Analyzing drawing: {drawing.name}")
            
            try:
                # Use GPT-4V to analyze drawing
                analysis = await self.gpt4v.analyze_construction_drawing(drawing)
                
                analysis_results.append({
                    "drawing_file": drawing.name,
                    "elements": analysis.get("elements", []),
                    "dimensions": analysis.get("dimensions", {}),
                    "materials": analysis.get("materials", {}),
                    "notes": analysis.get("notes", ""),
                    "raw_analysis": analysis
                })
                
            except Exception as e:
                logger.error(f"Failed to analyze {drawing.name}: {e}")
                analysis_results.append({
                    "drawing_file": drawing.name,
                    "error": str(e)
                })
        
        return analysis_results
    
    def _calculate_materials(self, drawing_analysis: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate materials from drawing analysis (БЕСПЛАТНО)
        
        Returns:
            Dict with material calculations:
            {
                "concrete": {
                    "volume": float,
                    "grade": str,
                    "positions": List
                },
                "reinforcement": {...},
                "formwork": {...}
            }
        """
        logger.info("Calculating materials from drawings...")
        
        calculations = {
            "concrete": {
                "volume": 0.0,
                "grade": "C25/30",
                "positions": []
            },
            "reinforcement": {
                "weight": 0.0,
                "class": "B500B",
                "positions": []
            },
            "formwork": {
                "area": 0.0,
                "type": "Standard",
                "positions": []
            }
        }
        
        # Extract and sum up materials from each drawing
        for analysis in drawing_analysis:
            if "error" in analysis:
                continue
            
            materials = analysis.get("materials", {})
            dimensions = analysis.get("dimensions", {})
            
            # Calculate concrete volume
            if "concrete" in materials:
                concrete_data = materials["concrete"]
                volume = concrete_data.get("volume", 0.0)
                calculations["concrete"]["volume"] += volume
                
                calculations["concrete"]["positions"].append({
                    "source": analysis["drawing_file"],
                    "volume": volume,
                    "grade": concrete_data.get("grade", "C25/30")
                })
            
            # Calculate reinforcement
            if "reinforcement" in materials:
                rebar_data = materials["reinforcement"]
                weight = rebar_data.get("weight", 0.0)
                calculations["reinforcement"]["weight"] += weight
                
                calculations["reinforcement"]["positions"].append({
                    "source": analysis["drawing_file"],
                    "weight": weight,
                    "class": rebar_data.get("class", "B500B")
                })
            
            # Calculate formwork
            if "formwork" in materials or dimensions:
                # Estimate formwork area from dimensions
                area = self._estimate_formwork_area(dimensions)
                calculations["formwork"]["area"] += area
                
                calculations["formwork"]["positions"].append({
                    "source": analysis["drawing_file"],
                    "area": area
                })
        
        logger.info(f"  Concrete: {calculations['concrete']['volume']:.2f} m³")
        logger.info(f"  Reinforcement: {calculations['reinforcement']['weight']:.2f} kg")
        logger.info(f"  Formwork: {calculations['formwork']['area']:.2f} m²")
        
        return calculations
    
    def _estimate_formwork_area(self, dimensions: Dict[str, Any]) -> float:
        """Estimate formwork area from dimensions"""
        # Simple heuristic - can be improved
        area = 0.0
        
        if "length" in dimensions and "height" in dimensions:
            length = dimensions.get("length", 0.0)
            height = dimensions.get("height", 0.0)
            area = length * height * 2  # Both sides
        
        return area
    
    async def execute(
        self,
        project_id: str,
        drawing_paths: List[Path],
        project_name: str
    ) -> Dict[str, Any]:
        """
        Execute Workflow B: Generate estimate from drawings
        
        This is a wrapper around process_drawings() for consistency with WorkflowA.
        
        Args:
            project_id: Project ID
            drawing_paths: List of paths to drawings
            project_name: Project name
        
        Returns:
            Dict with generated estimate and statistics
        """
        try:
            logger.info(f"🚀 Starting execute() for Workflow B project {project_id}")
            
            # Call the existing process_drawings method
            result = await self.process_drawings(
                drawings=drawing_paths,
                documentation=None,
                project_name=project_name
            )
            
            # Add project_id to result
            result["project_id"] = project_id
            
            # Calculate statistics for consistency with WorkflowA
            positions = result.get("generated_positions", [])
            
            # For Workflow B, all generated positions are initially "OK" (green)
            # They would need validation in a later step
            result.update({
                "total_positions": len(positions),
                "green_count": len(positions),
                "amber_count": 0,
                "red_count": 0,
                "ready_for_analysis": True
            })
            
            logger.info(f"✅ Workflow B execute complete: {len(positions)} positions generated")
            
            return result
            
        except Exception as e:
            logger.error(f"Workflow B execute failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "project_id": project_id
            }
    
    async def _generate_positions(
        self,
        drawing_analysis: List[Dict[str, Any]],
        calculations: Dict[str, Any],
        documentation: Optional[List[Path]]
    ) -> List[Dict[str, Any]]:
        """
        Generate estimate positions using Claude (ПЛАТНО)
        
        Returns:
            List of generated positions with KROS codes
        """
        logger.info("Generating positions with Claude...")
        
        # Prepare context for Claude
        context = {
            "drawing_analysis": drawing_analysis,
            "calculations": calculations,
            "documentation": []
        }
        
        # ✅ ИСПРАВЛЕНО: Используем SmartParser для документации
        if documentation:
            for doc in documentation:
                logger.info(f"  Processing documentation: {doc.name}")
                
                try:
                    # Определить тип файла
                    suffix = doc.suffix.lower()
                    
                    if suffix == '.txt':
                        # Простой текстовый файл - читаем напрямую
                        with open(doc, 'r', encoding='utf-8') as f:
                            content = f.read()[:5000]  # First 5000 chars
                        
                        context["documentation"].append({
                            "file": doc.name,
                            "type": "text",
                            "content": content
                        })
                    
                    elif suffix in ['.pdf', '.xlsx', '.xls', '.xml']:
                        # ✅ Структурированные документы - используем SmartParser
                        logger.info(f"    Using SmartParser for {suffix} document")
                        parsed_data = self.smart_parser.parse(doc, project_id=None)
                        
                        # Извлечь текстовое представление
                        if suffix == '.pdf':
                            content = parsed_data.get("raw_text", "")[:5000]
                        elif suffix in ['.xlsx', '.xls']:
                            # Для Excel - извлечь позиции как текст
                            positions = parsed_data.get("positions", [])
                            content = "\n".join([
                                f"{p.get('code', '')}: {p.get('description', '')}"
                                for p in positions[:50]  # First 50 positions
                            ])
                        elif suffix == '.xml':
                            # Для XML - извлечь позиции
                            positions = parsed_data.get("positions", [])
                            content = "\n".join([
                                f"{p.get('code', '')}: {p.get('description', '')}"
                                for p in positions[:50]
                            ])
                        
                        context["documentation"].append({
                            "file": doc.name,
                            "type": suffix[1:],  # Remove dot
                            "content": content,
                            "parsed_data": parsed_data
                        })
                    
                    else:
                        logger.warning(f"    Unsupported documentation format: {suffix}")
                        context["documentation"].append({
                            "file": doc.name,
                            "type": "unknown",
                            "error": f"Unsupported format: {suffix}"
                        })
                
                except Exception as e:
                    logger.warning(f"Failed to process {doc.name}: {e}")
                    context["documentation"].append({
                        "file": doc.name,
                        "error": str(e)
                    })
        
        # Load generation prompt
        prompt = self.claude._load_prompt_from_file("generation/generate_from_drawings")
        
        # Build full prompt
        import json
        full_prompt = f"""{prompt}

===== CONTEXT =====
{json.dumps(context, ensure_ascii=False, indent=2)}
"""
        
        # Generate positions with Claude
        result = self.claude.call(full_prompt)
        
        positions = result.get("positions", [])
        
        logger.info(f"✅ Generated {len(positions)} positions")
        return positions
    
    def _create_tech_card(
        self,
        project_name: str,
        drawing_analysis: List[Dict[str, Any]],
        calculations: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create technical card (БЕСПЛАТНО)
        
        Returns:
            Technical card with project details
        """
        tech_card = {
            "project_name": project_name,
            "drawings_analyzed": len(drawing_analysis),
            "materials": {
                "concrete": {
                    "total_volume": calculations["concrete"]["volume"],
                    "grade": calculations["concrete"]["grade"]
                },
                "reinforcement": {
                    "total_weight": calculations["reinforcement"]["weight"],
                    "class": calculations["reinforcement"]["class"]
                },
                "formwork": {
                    "total_area": calculations["formwork"]["area"],
                    "type": calculations["formwork"]["type"]
                }
            },
            "elements": []
        }
        
        # Extract unique elements
        all_elements = []
        for analysis in drawing_analysis:
            if "error" not in analysis:
                all_elements.extend(analysis.get("elements", []))
        
        # Deduplicate elements
        unique_elements = {}
        for elem in all_elements:
            elem_type = elem.get("type", "Unknown")
            if elem_type not in unique_elements:
                unique_elements[elem_type] = {
                    "type": elem_type,
                    "count": 0,
                    "instances": []
                }
            unique_elements[elem_type]["count"] += 1
            unique_elements[elem_type]["instances"].append(elem)
        
        tech_card["elements"] = list(unique_elements.values())
        
        return tech_card


class WorkflowBService:
    """Service wrapper providing cached access to Workflow B artifacts."""

    _SUPPORTED_ACTIONS = {
        "tech_card",
        "material_calculations",
        "drawing_analysis",
        "generated_vykaz",
    }

    def __init__(self) -> None:
        self._workflows: Dict[str, WorkflowB] = {}

    async def run(self, project_id: str, action: str, **kwargs) -> Any:  # noqa: D401 - keep signature consistent
        """Generate or retrieve Workflow B artifacts for the given action."""

        if action not in self._SUPPORTED_ACTIONS:
            raise ValueError(f"Unknown action for Workflow B: {action}")

        project_meta = self._get_or_create_project_meta(project_id)
        artifacts = project_meta.setdefault("artifacts", {})

        if action in artifacts and artifacts[action] is not None:
            return artifacts[action]

        source_payload = project_meta.get("audit_results")
        if isinstance(source_payload, dict) and source_payload:
            artifacts.update(self._extract_artifacts(source_payload))
            if action in artifacts and artifacts[action] is not None:
                return artifacts[action]

        generation_result = await self._execute_workflow(project_meta)
        if not generation_result.get("success", False):
            raise ValueError(
                generation_result.get("error")
                or f"Workflow B failed to generate artifact '{action}'"
            )

        project_meta["audit_results"] = generation_result
        artifacts.update(self._extract_artifacts(generation_result))
        self._persist_generation_result(project_id, generation_result)

        artifact = artifacts.get(action)
        if artifact is None:
            raise ValueError(f"Workflow B did not produce artifact '{action}'")
        return artifact

    def _get_or_create_project_meta(self, project_id: str) -> Dict[str, Any]:
        """Ensure minimal project metadata is available for Workflow B."""

        project_meta = project_store.get(project_id)
        if project_meta is not None:
            workflow = project_meta.get("workflow")
            if workflow and workflow != "B":
                raise ValueError(
                    f"Project {project_id} is not configured for Workflow B (workflow={workflow})"
                )
            project_meta.setdefault("workflow", "B")
            project_meta.setdefault("project_id", project_id)
            return project_meta

        uploads_dir = ArtifactPaths.raw_dir(project_id)
        if not uploads_dir.exists():
            raise ValueError(f"Project {project_id} not found for Workflow B")

        project_name = project_id
        info_path = uploads_dir / "project_info.json"
        if info_path.exists():
            try:
                with info_path.open("r", encoding="utf-8") as fp:
                    info_payload = json.load(fp)
                project_name = info_payload.get("project_name", project_name)
            except (OSError, json.JSONDecodeError):
                logger.warning(
                    "Project %s: Failed to read project_info.json for Workflow B reconstruction",
                    project_id,
                )

        reconstructed = {
            "project_id": project_id,
            "workflow": "B",
            "project_name": project_name,
            "drawings_path": str(uploads_dir / "vykresy"),
            "artifacts": {},
        }
        project_store[project_id] = reconstructed
        return reconstructed

    async def _execute_workflow(self, project_meta: Dict[str, Any]) -> Dict[str, Any]:
        """Run Workflow B on stored project files and return the generation payload."""

        project_id = project_meta.get("project_id", "unknown")
        project_name = project_meta.get("project_name") or project_id
        drawings_root = project_meta.get("drawings_path")
        if not drawings_root:
            raise ValueError(
                f"Project {project_id} does not contain drawings_path required for Workflow B"
            )

        drawing_dir = Path(drawings_root)
        if not drawing_dir.exists():
            raise ValueError(
                f"Drawings directory does not exist for project {project_id}: {drawing_dir}"
            )

        drawing_files = [path for path in sorted(drawing_dir.iterdir()) if path.is_file()]
        if not drawing_files:
            raise ValueError(
                f"No drawing files available for Workflow B project {project_id}"
            )

        workflow = self._workflows.setdefault(project_id, WorkflowB())
        result = await workflow.execute(
            project_id=project_id,
            drawing_paths=drawing_files,
            project_name=project_name,
        )
        return result

    @staticmethod
    def _extract_artifacts(result: Dict[str, Any]) -> Dict[str, Any]:
        """Map workflow results into individual artifacts for caching."""

        generated_positions = list(result.get("generated_positions") or [])
        artifact_map: Dict[str, Any] = {
            "tech_card": result.get("tech_card") or {},
            "material_calculations": result.get("calculations") or {},
            "drawing_analysis": result.get("drawing_analysis") or [],
            "generated_vykaz": {
                "positions": generated_positions,
                "total_positions": len(generated_positions),
            },
        }
        return artifact_map

    def _persist_generation_result(self, project_id: str, result: Dict[str, Any]) -> None:
        """Persist Workflow B generation outputs into artifact files."""

        try:
            ArtifactPaths.artifacts_dir(project_id).mkdir(parents=True, exist_ok=True)
            generated_positions_path = ArtifactPaths.generated_positions(project_id)
            positions_payload = {
                "items": result.get("generated_positions", []),
                "meta": {
                    "project_id": project_id,
                    "total_positions": len(result.get("generated_positions") or []),
                },
            }
            with generated_positions_path.open("w", encoding="utf-8") as fp:
                json.dump(positions_payload, fp, ensure_ascii=False, indent=2)

            audit_results_path = ArtifactPaths.audit_results(project_id)
            with audit_results_path.open("w", encoding="utf-8") as fp:
                json.dump(result, fp, ensure_ascii=False, indent=2)
        except OSError as exc:  # pragma: no cover - defensive logging
            logger.warning(
                "Project %s: failed to persist Workflow B artifacts: %s",
                project_id,
                exc,
            )


# Singleton-style adapter for API routes
workflow_b = WorkflowBService()


__all__ = ["WorkflowB", "workflow_b"]
