"""
Regression: /passport/generate must JSON-serialize the soupis_praci path.

The XLSX branch of POST /api/v1/passport/generate attaches the universal-parser
`soupis_praci` to a plain dict and returns it via `JSONResponse`, whose
`json.dumps` cannot serialize datetime objects. A plain `response.model_dump()`
leaves `passport.generated_at` as a `datetime` → 500 on EXACTLY the spreadsheet
path (which is why the Portal SoupisTab never lit up for XLSX uploads). The fix
is `model_dump(mode='json')`, which renders datetimes to ISO strings.

This pins the serialization contract without booting the full FastAPI app.
"""
import json

from app.models.passport_schema import ProjectPassport, PassportGenerationResponse


def _response_with_datetime() -> PassportGenerationResponse:
    passport = ProjectPassport(passport_id="p1", project_name="SO 202")
    # generated_at defaults to datetime.now() — a real datetime object.
    assert passport.generated_at is not None
    return PassportGenerationResponse(success=True, processing_time_ms=1, passport=passport)


def test_plain_model_dump_is_not_json_serializable():
    """Documents the bug: python-mode dump keeps datetime → json.dumps raises."""
    resp = _response_with_datetime()
    resp_dict = resp.model_dump()  # python mode (the old code path)
    resp_dict["soupis_praci"] = {"positions_count": 3}
    with __import__("pytest").raises(TypeError):
        json.dumps(resp_dict)  # what JSONResponse does internally


def test_model_dump_json_mode_serializes_with_soupis():
    """The fix: mode='json' renders datetimes → the soupis path serializes."""
    resp = _response_with_datetime()
    resp_dict = resp.model_dump(mode="json")
    resp_dict["soupis_praci"] = {
        "format": "komplet",
        "positions_count": 3,
        "stavebni_objekty": [],
    }
    encoded = json.dumps(resp_dict)  # must NOT raise
    assert '"soupis_praci"' in encoded
    assert isinstance(resp_dict["passport"]["generated_at"], str)


def test_generate_soupis_branch_uses_json_mode_dump():
    """Call-site guard: the /passport/generate soupis-attach branch must use
    model_dump(mode='json'), not a bare model_dump(). The model-contract tests
    above prove WHY; this pins the actual fix so a revert fails here (a bare
    model_dump would keep them green while re-introducing the 500)."""
    from pathlib import Path

    src = (
        Path(__file__).resolve().parents[1]
        / "app" / "api" / "routes_passport.py"
    ).read_text(encoding="utf-8")
    # The soupis_praci attach path builds resp_dict for a JSONResponse.
    assert 'resp_dict = (' in src or 'resp_dict =' in src
    assert "response.model_dump(mode='json')" in src or \
           'response.model_dump(mode="json")' in src, (
        "the /generate soupis branch must dump in JSON mode (datetime → ISO); "
        "a bare model_dump() re-introduces the 500 on the XLSX path"
    )
    # And no bare `.model_dump()` (mode-less) feeding a JSONResponse content on
    # the two attach paths — both must be json-mode.
    assert "classification.model_dump(mode='json')" in src or \
           'classification.model_dump(mode="json")' in src
