"""initial_schema

Creates all 9 core tables for Phase 4 Backend Infrastructure:
- users
- projects
- project_documents
- positions
- audit_results
- chat_messages
- background_jobs
- budget_versions
- knowledge_base_cache

Revision ID: 868b39220cfa
Revises:
Create Date: 2025-11-06 17:50:19.644744

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '868b39220cfa'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables for Phase 4."""

    # =================================================================
    # TABLE 1: users
    # =================================================================
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='user'),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'user', 'guest')", name='check_user_role'),
        sa.CheckConstraint("status IN ('pending', 'active', 'suspended', 'deleted')", name='check_user_status'),
    )
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_organization', 'users', ['organization_id'])

    # =================================================================
    # TABLE 2: projects
    # =================================================================
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('workflow', sa.String(20), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('progress', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('total_positions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_cost', sa.Numeric(15, 2), nullable=True),
        sa.Column('issues_count_green', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('issues_count_amber', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('issues_count_red', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("workflow IN ('workflow_a', 'workflow_b')", name='check_project_workflow'),
        sa.CheckConstraint("status IN ('draft', 'parsing', 'enriching', 'auditing', 'completed', 'error')", name='check_project_status'),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name='check_project_progress'),
    )
    op.create_index('idx_projects_user_id', 'projects', ['user_id'])
    op.create_index('idx_projects_status', 'projects', ['status'])
    op.create_index('idx_projects_created_at', 'projects', ['created_at'])

    # =================================================================
    # TABLE 3: project_documents
    # =================================================================
    op.create_table(
        'project_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('file_type', sa.String(50), nullable=False),
        sa.Column('storage_path', sa.String(1000), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('content_hash', sa.String(64), nullable=True),
        sa.Column('parse_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('indexed_content', sa.Text(), nullable=True),
        sa.Column('extracted_data', postgresql.JSONB, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("file_type IN ('pdf', 'xlsx', 'docx', 'xml', 'csv', 'jpg', 'png')", name='check_document_file_type'),
        sa.CheckConstraint("parse_status IN ('pending', 'processing', 'completed', 'failed')", name='check_document_parse_status'),
    )
    op.create_index('idx_documents_project_id', 'project_documents', ['project_id'])
    op.create_index('idx_documents_parse_status', 'project_documents', ['parse_status'])
    op.create_index('idx_documents_content_hash', 'project_documents', ['content_hash'])

    # Create full-text search index for indexed_content
    op.execute("""
        CREATE INDEX idx_documents_indexed_content_fts
        ON project_documents
        USING gin(to_tsvector('czech', COALESCE(indexed_content, '')))
    """)

    # =================================================================
    # TABLE 4: positions
    # =================================================================
    op.create_table(
        'positions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position_number', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('quantity', sa.Numeric(15, 3), nullable=False),
        sa.Column('unit', sa.String(20), nullable=False),
        sa.Column('unit_price', sa.Numeric(15, 2), nullable=True),
        sa.Column('total_price', sa.Numeric(15, 2), nullable=True),
        sa.Column('enrichment_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('enrichment_data', postgresql.JSONB, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("enrichment_status IN ('pending', 'processing', 'matched', 'no_match', 'error')", name='check_position_enrichment_status'),
        sa.UniqueConstraint('project_id', 'position_number', name='uq_project_position_number'),
    )
    op.create_index('idx_positions_project_id', 'positions', ['project_id'])
    op.create_index('idx_positions_code', 'positions', ['code'])
    op.create_index('idx_positions_enrichment_status', 'positions', ['enrichment_status'])

    # =================================================================
    # TABLE 5: audit_results
    # =================================================================
    op.create_table(
        'audit_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('positions.id', ondelete='CASCADE'), nullable=True),
        sa.Column('classification', sa.String(20), nullable=False),
        sa.Column('confidence', sa.Numeric(5, 2), nullable=False),
        sa.Column('expert_votes', postgresql.JSONB, nullable=True),
        sa.Column('issues', postgresql.JSONB, nullable=True),
        sa.Column('recommendations', postgresql.JSONB, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("classification IN ('GREEN', 'AMBER', 'RED')", name='check_audit_classification'),
        sa.CheckConstraint("confidence >= 0 AND confidence <= 100", name='check_audit_confidence'),
    )
    op.create_index('idx_audit_results_project_id', 'audit_results', ['project_id'])
    op.create_index('idx_audit_results_position_id', 'audit_results', ['position_id'])
    op.create_index('idx_audit_results_classification', 'audit_results', ['classification'])

    # =================================================================
    # TABLE 6: chat_messages
    # =================================================================
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('expert_type', sa.String(20), nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("role IN ('user', 'assistant', 'system')", name='check_chat_role'),
        sa.CheckConstraint("expert_type IS NULL OR expert_type IN ('SME', 'ARCH', 'ENG', 'SUP', 'ADMIN', 'PROJ')", name='check_chat_expert_type'),
    )
    op.create_index('idx_chat_messages_project_id', 'chat_messages', ['project_id'])
    op.create_index('idx_chat_messages_created_at', 'chat_messages', ['created_at'])
    op.create_index('idx_chat_messages_role', 'chat_messages', ['role'])

    # =================================================================
    # TABLE 7: background_jobs
    # =================================================================
    op.create_table(
        'background_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('task_name', sa.String(200), nullable=False),
        sa.Column('task_id', sa.String(200), nullable=True, unique=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('progress', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('result', postgresql.JSONB, nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')", name='check_job_status'),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name='check_job_progress'),
    )
    op.create_index('idx_background_jobs_project_id', 'background_jobs', ['project_id'])
    op.create_index('idx_background_jobs_user_id', 'background_jobs', ['user_id'])
    op.create_index('idx_background_jobs_status', 'background_jobs', ['status'])
    op.create_index('idx_background_jobs_task_id', 'background_jobs', ['task_id'])
    op.create_index('idx_background_jobs_created_at', 'background_jobs', ['created_at'])

    # =================================================================
    # TABLE 8: budget_versions
    # =================================================================
    op.create_table(
        'budget_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('trigger_type', sa.String(50), nullable=False),
        sa.Column('changes', postgresql.JSONB, nullable=True),
        sa.Column('delta_cost', sa.Numeric(15, 2), nullable=True),
        sa.Column('snapshot', postgresql.JSONB, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("trigger_type IN ('initial_generation', 'document_added', 'user_edit', 'chat_modification', 'enrichment_update')", name='check_version_trigger_type'),
        sa.UniqueConstraint('project_id', 'version', name='uq_project_version'),
    )
    op.create_index('idx_budget_versions_project_id', 'budget_versions', ['project_id'])
    op.create_index('idx_budget_versions_created_at', 'budget_versions', ['created_at'])

    # =================================================================
    # TABLE 9: knowledge_base_cache
    # =================================================================
    op.create_table(
        'knowledge_base_cache',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('query_hash', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('task_type', sa.String(50), nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('result', postgresql.JSONB, nullable=False),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('confidence', sa.Numeric(5, 2), nullable=True),
        sa.Column('cost', sa.Numeric(10, 4), nullable=False, server_default='0.0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("task_type IN ('static_lookup', 'current_price', 'equipment_spec', 'document_qa', 'standard_text', 'best_practice', 'validation')", name='check_kb_cache_task_type'),
        sa.CheckConstraint("source IN ('local_kb', 'perplexity', 'claude', 'urs', 'cenovamapa', 'csn_online')", name='check_kb_cache_source'),
    )
    op.create_index('idx_kb_cache_query_hash', 'knowledge_base_cache', ['query_hash'])
    op.create_index('idx_kb_cache_task_type', 'knowledge_base_cache', ['task_type'])
    op.create_index('idx_kb_cache_expires_at', 'knowledge_base_cache', ['expires_at'])

    # =================================================================
    # TABLE 10: user_credentials (for credential management)
    # =================================================================
    op.create_table(
        'user_credentials',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('service_name', sa.String(100), nullable=False),
        sa.Column('credential_type', sa.String(50), nullable=False),
        sa.Column('encrypted_username', sa.Text(), nullable=True),
        sa.Column('encrypted_password', sa.Text(), nullable=True),
        sa.Column('encrypted_api_key', sa.Text(), nullable=True),
        sa.Column('scope', sa.String(20), nullable=False, server_default='personal'),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('monthly_query_limit', sa.Integer(), nullable=False, server_default='1000'),
        sa.Column('monthly_queries_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('encryption_key_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("scope IN ('personal', 'shared')", name='check_credential_scope'),
        sa.CheckConstraint("status IN ('active', 'expired', 'revoked')", name='check_credential_status'),
        sa.CheckConstraint("credential_type IN ('username_password', 'api_key', 'oauth')", name='check_credential_type'),
        sa.UniqueConstraint('user_id', 'service_name', name='uq_user_service'),
    )
    op.create_index('idx_user_credentials_user_id', 'user_credentials', ['user_id'])
    op.create_index('idx_user_credentials_service_name', 'user_credentials', ['service_name'])
    op.create_index('idx_user_credentials_organization_id', 'user_credentials', ['organization_id'])


def downgrade() -> None:
    """Drop all tables in reverse order."""
    op.drop_table('user_credentials')
    op.drop_table('knowledge_base_cache')
    op.drop_table('budget_versions')
    op.drop_table('background_jobs')
    op.drop_table('chat_messages')
    op.drop_table('audit_results')
    op.drop_table('positions')
    op.drop_table('project_documents')
    op.drop_table('projects')
    op.drop_table('users')
