"""Feature clusters and their members."""

from uuid import uuid4

from sqlmodel import Field, SQLModel


class FeatureCluster(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, description="UUID primary key")
    snapshot_id: str = Field(foreign_key="projectgraphsnapshot.id", description="Parent snapshot")
    method: str = Field(description="Clustering algorithm name")
    method_version: str = Field(description="Clustering algorithm version")
    label: str = Field(description="Human-readable cluster label")
    centroid_unit_id: str | None = Field(default=None, foreign_key="codeunit.id", description="Representative code unit")


class ClusterMember(SQLModel, table=True):
    __table_args__ = ({"extend_existing": True},)

    cluster_id: str = Field(foreign_key="featurecluster.id", primary_key=True, description="Parent cluster")
    code_unit_id: str = Field(foreign_key="codeunit.id", primary_key=True, description="Member code unit")
