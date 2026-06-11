from pydantic import BaseModel, Field


class ExecutionResult(BaseModel):
    stdout: str = ""
    stderr: str = ""
    exit_code: int = Field(alias="exitCode")
    duration_ms: int = Field(alias="durationMs")

    model_config = {"populate_by_name": True, "serialize_by_alias": True}
