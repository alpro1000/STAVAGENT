"""
Manual Test Script for Multi-Role AI System

Tests the system with REAL Claude API calls.

Requirements:
- ANTHROPIC_API_KEY must be set in environment or .env file

Usage:
    python scripts/test_multi_role_system.py

Or run specific test:
    python scripts/test_multi_role_system.py --test simple
    python scripts/test_multi_role_system.py --test complex
    python scripts/test_multi_role_system.py --test all
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import argparse
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table

from app.services.task_classifier import classify_task
from app.services.orchestrator import execute_multi_role
from app.core.config import settings


console = Console()


def print_header(title: str):
    """Print section header"""
    console.print()
    console.print(f"[bold cyan]{'=' * 80}[/bold cyan]")
    console.print(f"[bold cyan]{title.center(80)}[/bold cyan]")
    console.print(f"[bold cyan]{'=' * 80}[/bold cyan]")
    console.print()


def print_classification(classification):
    """Print classification results"""
    console.print("[bold]📊 CLASSIFICATION:[/bold]")
    console.print(f"  Complexity: [yellow]{classification.complexity.value}[/yellow]")
    console.print(f"  Domains: [cyan]{', '.join([d.value for d in classification.domains])}[/cyan]")
    console.print(f"  Roles: [green]{', '.join([r.role.value for r in classification.roles])}[/green]")
    console.print(f"  RFI Required: [{'red' if classification.requires_rfi else 'green'}]{classification.requires_rfi}[/]")
    if classification.missing_data:
        console.print(f"  Missing Data: [red]{', '.join(classification.missing_data)}[/red]")
    console.print(f"  Confidence: [blue]{classification.confidence:.0%}[/blue]")
    console.print()


def print_result(result):
    """Print final result"""
    console.print("[bold]📄 FINAL RESULT:[/bold]")
    console.print()

    # Status
    status = result.get_status()
    if "✅" in status:
        status_color = "green"
    elif "⚠️" in status:
        status_color = "yellow"
    else:
        status_color = "red"

    console.print(f"  Status: [{status_color}]{status}[/{status_color}]")
    console.print(f"  Roles Consulted: [cyan]{', '.join([r.value for r in result.roles_consulted])}[/cyan]")
    console.print(f"  Conflicts: [yellow]{len(result.conflicts)}[/yellow]")
    console.print(f"  Warnings: [yellow]{len(result.warnings)}[/yellow]")
    console.print(f"  Critical Issues: [red]{len(result.critical_issues)}[/red]")
    console.print(f"  Tokens Used: [blue]{result.total_tokens}[/blue]")
    console.print(f"  Execution Time: [blue]{result.execution_time_seconds:.2f}s[/blue]")
    console.print(f"  Confidence: [blue]{result.confidence:.0%}[/blue]")
    console.print()

    # Answer
    console.print(Panel(result.answer, title="[bold]Answer[/bold]", border_style="green"))

    # Conflicts
    if result.conflicts:
        console.print()
        console.print("[bold]⚖️ CONFLICTS RESOLVED:[/bold]")
        for i, conflict in enumerate(result.conflicts, 1):
            console.print(f"  {i}. [yellow]{conflict.conflict_type.value}[/yellow]")
            for desc in conflict.descriptions:
                console.print(f"     - {desc}")
            if conflict.resolution:
                console.print(f"     → [green]Resolution: {conflict.resolution}[/green]")
        console.print()

    # Warnings
    if result.warnings:
        console.print("[bold]⚠️ WARNINGS:[/bold]")
        for warning in result.warnings:
            console.print(f"  - [yellow]{warning}[/yellow]")
        console.print()

    # Critical Issues
    if result.critical_issues:
        console.print("[bold]🚨 CRITICAL ISSUES:[/bold]")
        for issue in result.critical_issues:
            console.print(f"  - [red]{issue}[/red]")
        console.print()


def test_simple_otskp_lookup():
    """Test 1: Simple OTSKP code lookup"""
    print_header("TEST 1: Simple OTSKP Lookup")

    question = "What's the OTSKP code for concrete foundation?"
    console.print(f"[bold]Question:[/bold] {question}")
    console.print()

    # Classify
    console.print("[dim]Classifying question...[/dim]")
    classification = classify_task(question)
    print_classification(classification)

    # Execute
    console.print("[dim]Executing multi-role workflow...[/dim]")
    result = execute_multi_role(question, classification)

    # Print result
    print_result(result)

    return result


def test_volume_calculation():
    """Test 2: Standard volume calculation"""
    print_header("TEST 2: Volume Calculation")

    question = "Calculate concrete volume for foundation 15m × 6m × 0.5m"
    console.print(f"[bold]Question:[/bold] {question}")
    console.print()

    # Classify
    console.print("[dim]Classifying question...[/dim]")
    classification = classify_task(question)
    print_classification(classification)

    # Execute
    console.print("[dim]Executing multi-role workflow...[/dim]")
    result = execute_multi_role(question, classification)

    # Print result
    print_result(result)

    return result


def test_concrete_class_adequacy():
    """Test 3: Concrete class adequacy check (potential conflict)"""
    print_header("TEST 3: Concrete Class Adequacy Check")

    question = "Is C25/30 adequate for 5-story building foundation in outdoor environment?"
    console.print(f"[bold]Question:[/bold] {question}")
    console.print()

    # Classify
    console.print("[dim]Classifying question...[/dim]")
    classification = classify_task(question)
    print_classification(classification)

    # Execute
    console.print("[dim]Executing multi-role workflow...[/dim]")
    result = execute_multi_role(question, classification)

    # Print result
    print_result(result)

    return result


def test_project_validation():
    """Test 4: Complex project validation"""
    print_header("TEST 4: Project Validation")

    question = "Check foundation design: 12m × 5m, concrete C25/30, outdoor with deicing salts"
    console.print(f"[bold]Question:[/bold] {question}")
    console.print()

    # Classify
    console.print("[dim]Classifying question...[/dim]")
    classification = classify_task(question)
    print_classification(classification)

    # Execute
    console.print("[dim]Executing multi-role workflow...[/dim]")
    result = execute_multi_role(question, classification)

    # Print result
    print_result(result)

    return result


def test_pipe_sdr_check():
    """Test 5: PE pipe SDR compatibility"""
    print_header("TEST 5: PE Pipe SDR Compatibility Check")

    question = "Check if PE pipe SDR11, diameter 90mm, wall thickness 5.4mm is correct"
    console.print(f"[bold]Question:[/bold] {question}")
    console.print()

    # Classify
    console.print("[dim]Classifying question...[/dim]")
    classification = classify_task(question)
    print_classification(classification)

    # Execute
    console.print("[dim]Executing multi-role workflow...[/dim]")
    result = execute_multi_role(question, classification)

    # Print result
    print_result(result)

    return result


def test_czech_language():
    """Test 6: Question in Czech"""
    print_header("TEST 6: Czech Language Question")

    question = "Jaký je kód OTSKP pro betonování základů?"
    console.print(f"[bold]Question:[/bold] {question}")
    console.print()

    # Classify
    console.print("[dim]Classifying question...[/dim]")
    classification = classify_task(question)
    print_classification(classification)

    # Execute
    console.print("[dim]Executing multi-role workflow...[/dim]")
    result = execute_multi_role(question, classification)

    # Print result
    print_result(result)

    return result


def run_all_tests():
    """Run all tests"""
    tests = [
        ("Simple OTSKP Lookup", test_simple_otskp_lookup),
        ("Volume Calculation", test_volume_calculation),
        ("Concrete Class Adequacy", test_concrete_class_adequacy),
        ("Project Validation", test_project_validation),
        ("PE Pipe SDR Check", test_pipe_sdr_check),
        ("Czech Language", test_czech_language),
    ]

    results = []

    for test_name, test_func in tests:
        try:
            console.print(f"\n[bold cyan]Running: {test_name}...[/bold cyan]")
            result = test_func()
            results.append((test_name, "✅ PASS", result))
        except Exception as e:
            console.print(f"[bold red]❌ FAIL: {e}[/bold red]")
            results.append((test_name, "❌ FAIL", str(e)))

    # Summary
    print_header("TEST SUMMARY")

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Test", style="dim", width=30)
    table.add_column("Status", width=15)
    table.add_column("Details", width=30)

    for test_name, status, result in results:
        if "✅" in status:
            status_style = "green"
            details = f"Tokens: {result.total_tokens}, Time: {result.execution_time_seconds:.2f}s"
        else:
            status_style = "red"
            details = str(result)[:30]

        table.add_row(test_name, f"[{status_style}]{status}[/{status_style}]", details)

    console.print(table)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Test Multi-Role AI System")
    parser.add_argument(
        "--test",
        choices=["simple", "volume", "adequacy", "validation", "pipe", "czech", "all"],
        default="all",
        help="Which test to run"
    )

    args = parser.parse_args()

    # Check API key
    if not settings.ANTHROPIC_API_KEY:
        console.print("[bold red]ERROR: ANTHROPIC_API_KEY not set![/bold red]")
        console.print("Set it in .env file or environment variable")
        return 1

    console.print(f"[bold green]✓ Claude API Key configured[/bold green]")
    console.print(f"[dim]Model: {settings.CLAUDE_MODEL}[/dim]")
    console.print()

    # Run selected test
    if args.test == "simple":
        test_simple_otskp_lookup()
    elif args.test == "volume":
        test_volume_calculation()
    elif args.test == "adequacy":
        test_concrete_class_adequacy()
    elif args.test == "validation":
        test_project_validation()
    elif args.test == "pipe":
        test_pipe_sdr_check()
    elif args.test == "czech":
        test_czech_language()
    elif args.test == "all":
        run_all_tests()

    return 0


if __name__ == "__main__":
    sys.exit(main())
