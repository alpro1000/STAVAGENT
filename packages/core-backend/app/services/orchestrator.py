"""
Multi-Role AI Orchestrator

Coordinates specialist roles to answer complex construction engineering questions.

Workflow:
1. Receive TaskClassification from task_classifier
2. Load role prompts from app/prompts/roles/
3. Invoke roles in sequence via Claude API
4. Pass context between roles
5. Resolve conflicts using consensus protocol
6. Generate final structured output
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.services.task_classifier import (
    TaskClassification,
    Role,
    RoleInvocation,
    TaskComplexity,
)
from app.core.claude_client import ClaudeClient
from app.core.config import settings


# ============================================================================
# DATA STRUCTURES
# ============================================================================

class ConflictType(str, Enum):
    """Types of conflicts between roles"""
    CONCRETE_CLASS = "concrete_class"          # C25/30 vs C30/37
    SAFETY_VS_COST = "safety_vs_cost"          # Safety requirement vs budget
    STANDARD_VIOLATION = "standard_violation"   # Specialist vs Standards Checker
    INCONSISTENT_DATA = "inconsistent_data"     # Different values from different roles


@dataclass
class RoleOutput:
    """Output from a single role"""
    role: Role
    content: str
    temperature_used: float
    tokens_used: int
    timestamp: datetime
    confidence: Optional[float] = None  # 0.0-1.0 if role provides it
    warnings: List[str] = field(default_factory=list)
    critical_issues: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)  # Role-specific data


@dataclass
class Conflict:
    """Represents a disagreement between roles"""
    conflict_type: ConflictType
    roles_involved: List[Role]
    descriptions: List[str]  # Each role's position
    resolution: Optional[str] = None  # How it was resolved
    winner: Optional[Role] = None  # Which role's decision was accepted


@dataclass
class FinalOutput:
    """Final structured output to user"""
    answer: str  # Main answer to user's question
    complexity: TaskComplexity
    roles_consulted: List[Role]
    conflicts: List[Conflict]
    warnings: List[str]  # All warnings from all roles
    critical_issues: List[str]  # All critical issues
    total_tokens: int
    execution_time_seconds: float
    confidence: float  # Overall confidence 0.0-1.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def has_critical_issues(self) -> bool:
        """Check if there are any critical issues"""
        return len(self.critical_issues) > 0

    def get_status(self) -> str:
        """Get overall status"""
        if self.has_critical_issues():
            return "❌ CRITICAL ISSUES FOUND"
        elif len(self.warnings) > 0:
            return "⚠️ WARNINGS"
        else:
            return "✅ OK"


# ============================================================================
# ORCHESTRATOR
# ============================================================================

class MultiRoleOrchestrator:
    """
    Orchestrates multiple specialist AI roles to answer complex questions
    """

    def __init__(self):
        """Initialize orchestrator"""
        self.prompts_dir = Path(__file__).parent.parent / "prompts" / "roles"
        self.role_outputs: List[RoleOutput] = []
        self.conflicts: List[Conflict] = []
        self.claude_client = ClaudeClient()

    def execute(
        self,
        user_question: str,
        classification: TaskClassification,
        context: Optional[Dict[str, Any]] = None
    ) -> FinalOutput:
        """
        Execute multi-role workflow

        Args:
            user_question: Original user question
            classification: TaskClassification from classifier
            context: Optional context (files, previous conversation, etc.)

        Returns:
            FinalOutput with answer and metadata
        """
        start_time = datetime.now()

        # Reset state
        self.role_outputs = []
        self.conflicts = []

        # Get ordered roles
        ordered_roles = classification.get_roles_ordered()

        print(f"\n🎯 Executing {len(ordered_roles)} roles for complexity: {classification.complexity}")
        print(f"   Roles: {[r.role.value for r in ordered_roles]}")

        # Execute each role in sequence
        for i, role_invocation in enumerate(ordered_roles):
            print(f"\n[{i+1}/{len(ordered_roles)}] Invoking {role_invocation.role.value}...")

            output = self._invoke_role(
                role_invocation=role_invocation,
                user_question=user_question,
                classification=classification,
                context=context,
            )

            self.role_outputs.append(output)

            # Check for conflicts after each role (except first)
            if i > 0:
                self._detect_and_resolve_conflicts()

        # Generate final answer
        final_answer = self._synthesize_final_answer(user_question, classification)

        # Calculate total tokens
        total_tokens = sum(output.tokens_used for output in self.role_outputs)

        # Calculate execution time
        execution_time = (datetime.now() - start_time).total_seconds()

        # Aggregate warnings and critical issues
        all_warnings = []
        all_critical = []
        for output in self.role_outputs:
            all_warnings.extend(output.warnings)
            all_critical.extend(output.critical_issues)

        # Calculate overall confidence
        confidences = [o.confidence for o in self.role_outputs if o.confidence is not None]
        overall_confidence = sum(confidences) / len(confidences) if confidences else 0.8

        return FinalOutput(
            answer=final_answer,
            complexity=classification.complexity,
            roles_consulted=[r.role for r in ordered_roles],
            conflicts=self.conflicts,
            warnings=all_warnings,
            critical_issues=all_critical,
            total_tokens=total_tokens,
            execution_time_seconds=execution_time,
            confidence=overall_confidence,
            metadata={
                "classification": classification,
                "role_outputs": self.role_outputs,
            }
        )

    def _invoke_role(
        self,
        role_invocation: RoleInvocation,
        user_question: str,
        classification: TaskClassification,
        context: Optional[Dict[str, Any]] = None,
    ) -> RoleOutput:
        """
        Invoke a single role

        Args:
            role_invocation: Role configuration
            user_question: Original question
            classification: Task classification
            context: Optional context

        Returns:
            RoleOutput with response
        """
        # Load role prompt
        role_prompt = self._load_role_prompt(role_invocation.role)

        # Build context from previous roles
        previous_context = self._build_context_from_previous_roles(role_invocation.role)

        # Construct full prompt
        full_prompt = self._construct_prompt(
            role_prompt=role_prompt,
            user_question=user_question,
            previous_context=previous_context,
            role_invocation=role_invocation,
            context=context,
        )

        # Call Claude API
        start_time = datetime.now()

        try:
            response = self.claude_client.call(
                prompt=full_prompt,
                system_prompt=None,  # Role prompt is included in user message
                temperature=role_invocation.temperature,
            )

            # Extract content
            # Response can be dict with "raw_text" or other structure
            if "raw_text" in response:
                content = response["raw_text"]
            else:
                # Try to convert dict to string if it's structured data
                content = str(response)

            # Estimate tokens (rough estimate based on characters)
            tokens_used = len(content) // 4

        except Exception as e:
            print(f"   ❌ Error invoking {role_invocation.role.value}: {e}")
            content = f"[ERROR: Failed to invoke role: {str(e)}]"
            tokens_used = 0

        # Parse output for warnings and critical issues
        warnings, critical_issues = self._parse_warnings_and_issues(content)

        # Extract confidence if present
        confidence = self._extract_confidence(content)

        return RoleOutput(
            role=role_invocation.role,
            content=content,
            temperature_used=role_invocation.temperature,
            tokens_used=tokens_used,
            timestamp=datetime.now(),
            confidence=confidence,
            warnings=warnings,
            critical_issues=critical_issues,
        )

    def _load_role_prompt(self, role: Role) -> str:
        """Load role prompt from file"""
        prompt_file = self.prompts_dir / f"{role.value}.md"

        if not prompt_file.exists():
            raise FileNotFoundError(f"Role prompt not found: {prompt_file}")

        with open(prompt_file, "r", encoding="utf-8") as f:
            return f.read()

    def _build_context_from_previous_roles(self, current_role: Role) -> str:
        """Build context string from previous roles' outputs"""
        if not self.role_outputs:
            return ""

        context_parts = ["## CONTEXT FROM PREVIOUS ROLES:\n"]

        for output in self.role_outputs:
            context_parts.append(f"### FROM {output.role.value.upper().replace('_', ' ')}:\n")
            context_parts.append(f"{output.content}\n\n")
            context_parts.append("---\n\n")

        return "\n".join(context_parts)

    def _construct_prompt(
        self,
        role_prompt: str,
        user_question: str,
        previous_context: str,
        role_invocation: RoleInvocation,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Construct full prompt for role"""

        parts = []

        # 1. Role definition (system prompt)
        parts.append(role_prompt)
        parts.append("\n\n---\n\n")

        # 2. Previous roles' context (if any)
        if previous_context:
            parts.append(previous_context)
            parts.append("---\n\n")

        # 3. User question
        parts.append("## USER QUESTION:\n\n")
        parts.append(f"{user_question}\n\n")

        # 4. Additional context (if any)
        if context:
            parts.append("## ADDITIONAL CONTEXT:\n\n")
            for key, value in context.items():
                parts.append(f"**{key}:** {value}\n")
            parts.append("\n")

        # 5. Role-specific instructions (if any)
        if role_invocation.context:
            parts.append("## YOUR TASK:\n\n")
            parts.append(f"{role_invocation.context}\n\n")

        return "".join(parts)

    def _parse_warnings_and_issues(self, content: str) -> Tuple[List[str], List[str]]:
        """
        Parse warnings and critical issues from role output

        Returns:
            (warnings, critical_issues)
        """
        warnings = []
        critical_issues = []

        # Find warning markers
        warning_pattern = r"⚠️\s*(?:WARNING|ВЫСОКИЙ ПРИОРИТЕТ):\s*(.+?)(?=\n\n|\n#{1,3}|\n⚠️|\n🚨|$)"
        critical_pattern = r"🚨\s*(?:CRITICAL|КРИТИЧНО):\s*(.+?)(?=\n\n|\n#{1,3}|\n⚠️|\n🚨|$)"

        for match in re.finditer(warning_pattern, content, re.DOTALL | re.IGNORECASE):
            warning_text = match.group(1).strip()
            warnings.append(warning_text)

        for match in re.finditer(critical_pattern, content, re.DOTALL | re.IGNORECASE):
            critical_text = match.group(1).strip()
            critical_issues.append(critical_text)

        return warnings, critical_issues

    def _extract_confidence(self, content: str) -> Optional[float]:
        """Extract confidence level if present in output"""
        # Look for patterns like "Confidence: 95%" or "Уверенность: 0.95"
        patterns = [
            r"confidence[:\s]+(\d+)%",
            r"confidence[:\s]+(0\.\d+)",
            r"уверенность[:\s]+(\d+)%",
            r"уверенность[:\s]+(0\.\d+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                value = match.group(1)
                if "." in value:
                    return float(value)
                else:
                    return float(value) / 100.0

        return None

    def _detect_and_resolve_conflicts(self):
        """Detect and resolve conflicts between roles"""
        if len(self.role_outputs) < 2:
            return

        # Get last two outputs
        previous_output = self.role_outputs[-2]
        current_output = self.role_outputs[-1]

        # Check for concrete class conflicts
        prev_class = self._extract_concrete_class(previous_output.content)
        curr_class = self._extract_concrete_class(current_output.content)

        if prev_class and curr_class and prev_class != curr_class:
            conflict = Conflict(
                conflict_type=ConflictType.CONCRETE_CLASS,
                roles_involved=[previous_output.role, current_output.role],
                descriptions=[
                    f"{previous_output.role.value}: {prev_class}",
                    f"{current_output.role.value}: {curr_class}",
                ]
            )

            # Resolve using hierarchy: Stricter requirement wins
            winner, resolution = self._resolve_concrete_class_conflict(
                prev_class, curr_class, previous_output.role, current_output.role
            )

            conflict.winner = winner
            conflict.resolution = resolution

            self.conflicts.append(conflict)
            print(f"   ⚖️ Conflict detected: {prev_class} vs {curr_class}")
            print(f"      Resolution: {resolution}")

    def _extract_concrete_class(self, content: str) -> Optional[str]:
        """Extract concrete class from role output"""
        # Look for patterns like C25/30, C30/37, etc.
        match = re.search(r"\bC(\d{2})/(\d{2})\b", content)
        if match:
            return match.group(0)
        return None

    def _resolve_concrete_class_conflict(
        self,
        class1: str,
        class2: str,
        role1: Role,
        role2: Role
    ) -> Tuple[Role, str]:
        """
        Resolve concrete class conflict using consensus protocol

        Rules:
        1. Standards Checker always wins (final authority on code compliance)
        2. Stricter requirement wins (C30/37 > C25/30)
        3. If structural vs durability: both must be met → higher class wins

        Returns:
            (winner_role, resolution_explanation)
        """

        # Extract numeric values
        class1_num = int(class1.split("/")[0][1:])
        class2_num = int(class2.split("/")[0][1:])

        # Rule 1: Standards Checker wins
        if role2 == Role.STANDARDS_CHECKER:
            return (
                role2,
                f"Standards Checker has final authority on code compliance. Using {class2}."
            )
        elif role1 == Role.STANDARDS_CHECKER:
            return (
                role1,
                f"Standards Checker has final authority on code compliance. Using {class1}."
            )

        # Rule 2: Stricter requirement wins
        if class1_num > class2_num:
            return (
                role1,
                f"Stricter requirement wins: {class1} > {class2}. Both load and durability must be met."
            )
        else:
            return (
                role2,
                f"Stricter requirement wins: {class2} > {class1}. Both load and durability must be met."
            )

    def _synthesize_final_answer(
        self,
        user_question: str,
        classification: TaskClassification
    ) -> str:
        """
        Synthesize final answer from all role outputs

        This combines outputs from all roles into a coherent final answer
        """
        parts = []

        # Header
        parts.append(f"# ANSWER: {user_question}\n\n")

        # Executive summary (from last role if Standards Checker, or combination)
        if self.role_outputs:
            last_output = self.role_outputs[-1]

            # Extract "RESULT" or "CONCLUSION" section if present
            result_match = re.search(
                r"##?\s*(?:RESULT|CONCLUSION|VERDICT|ANSWER)[\s:]+(.+?)(?=\n#{1,2}|$)",
                last_output.content,
                re.DOTALL | re.IGNORECASE
            )

            if result_match:
                parts.append("## SUMMARY\n\n")
                parts.append(result_match.group(1).strip() + "\n\n")

        # Critical issues (if any)
        all_critical = []
        for output in self.role_outputs:
            all_critical.extend(output.critical_issues)

        if all_critical:
            parts.append("## 🚨 CRITICAL ISSUES\n\n")
            for i, issue in enumerate(all_critical, 1):
                parts.append(f"{i}. {issue}\n")
            parts.append("\n")

        # Warnings (if any)
        all_warnings = []
        for output in self.role_outputs:
            all_warnings.extend(output.warnings)

        if all_warnings:
            parts.append("## ⚠️ WARNINGS\n\n")
            for i, warning in enumerate(all_warnings, 1):
                parts.append(f"{i}. {warning}\n")
            parts.append("\n")

        # Conflicts resolved (if any)
        if self.conflicts:
            parts.append("## ⚖️ CONFLICTS RESOLVED\n\n")
            for conflict in self.conflicts:
                parts.append(f"**{conflict.conflict_type.value.replace('_', ' ').title()}:**\n")
                for desc in conflict.descriptions:
                    parts.append(f"- {desc}\n")
                if conflict.resolution:
                    parts.append(f"\n**Resolution:** {conflict.resolution}\n\n")

        # Detailed findings from each role
        parts.append("## DETAILED ANALYSIS\n\n")
        for output in self.role_outputs:
            parts.append(f"### {output.role.value.replace('_', ' ').title()}\n\n")

            # Extract main content (skip role definition if present)
            content = output.content

            # Remove the role definition header if it appears
            content = re.sub(r"^#\s*ROLE:.*?---", "", content, flags=re.DOTALL)

            # Clean up and add
            parts.append(content.strip() + "\n\n")
            parts.append("---\n\n")

        # Footer: Roles consulted
        parts.append("## REVIEWED BY\n\n")
        for output in self.role_outputs:
            parts.append(f"- ✅ {output.role.value.replace('_', ' ').title()}")
            if output.confidence:
                parts.append(f" (confidence: {output.confidence:.0%})")
            parts.append("\n")

        return "".join(parts)


# ============================================================================
# CONVENIENCE FUNCTION
# ============================================================================

def execute_multi_role(
    user_question: str,
    classification: TaskClassification,
    context: Optional[Dict[str, Any]] = None
) -> FinalOutput:
    """
    Convenience function to execute multi-role workflow

    Args:
        user_question: User's question
        classification: TaskClassification from classifier
        context: Optional context

    Returns:
        FinalOutput with answer
    """
    orchestrator = MultiRoleOrchestrator()
    return orchestrator.execute(user_question, classification, context)
