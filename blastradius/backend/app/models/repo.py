from uuid import uuid4

from sqlmodel import Field, SQLModel


class Repo(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str = Field()
    remote_url: str | None = Field(default=None)
    source_root: str | None = Field(default=None)
    welcome_message: str | None = Field(default=None)
