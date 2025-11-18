"""initial database

Revision ID: a0a693f9fcbd
Revises: 
Create Date: 2025-11-19 00:50:16.715730

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mssql

# revision identifiers, used by Alembic.
revision: str = 'a0a693f9fcbd'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass



def downgrade() -> None:
    pass

