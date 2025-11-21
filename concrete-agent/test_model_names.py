"""
Test script to verify unique model names in OpenAPI schema
"""
from fastapi.openapi.utils import get_openapi
from app.main import app

# Generate OpenAPI schema
openapi_schema = get_openapi(
    title=app.title,
    version=app.version,
    description=app.description,
    routes=app.routes,
)

print("=" * 80)
print("CHECKING FOR MODEL NAME COLLISIONS")
print("=" * 80)

schemas = openapi_schema.get("components", {}).get("schemas", {})

print(f"\nTotal schemas: {len(schemas)}\n")

# Check for module-prefixed names (indicating collisions)
problematic_schemas = []
for schema_name in sorted(schemas.keys()):
    if "__" in schema_name and "app__api" in schema_name:
        problematic_schemas.append(schema_name)
        print(f"[WARNING] COLLISION DETECTED: {schema_name}")

if not problematic_schemas:
    print("[OK] NO COLLISIONS! All model names are unique.")
else:
    print(f"\n[ERROR] Found {len(problematic_schemas)} collision(s)")

print("\n" + "=" * 80)
print("WORKFLOW A MODELS:")
print("=" * 80)
workflow_a_models = [s for s in schemas.keys() if "WorkflowA" in s]
for model in sorted(workflow_a_models):
    print(f"  + {model}")

print("\n" + "=" * 80)
print("WORKFLOW B MODELS:")
print("=" * 80)
workflow_b_models = [s for s in schemas.keys() if "WorkflowB" in s]
for model in sorted(workflow_b_models):
    print(f"  + {model}")

print("\n" + "=" * 80)
print("CHECKING ENDPOINTS")
print("=" * 80)

endpoints_to_check = [
    '/api/workflow/a/tech-card',
    '/api/workflow/a/resource-sheet',
    '/api/workflow/a/materials',
    '/api/workflow/a/enrich',
]

for endpoint in endpoints_to_check:
    if endpoint in openapi_schema['paths']:
        post_data = openapi_schema['paths'][endpoint].get('post', {})
        request_body = post_data.get('requestBody', {})

        if 'content' in request_body:
            schema_ref = request_body['content']['application/json']['schema']
            if '$ref' in schema_ref:
                model_name = schema_ref['$ref'].split('/')[-1]

                # Check if it's a clean name
                if "__" in model_name:
                    print(f"[ERROR] {endpoint}: {model_name} (HAS MODULE PREFIX)")
                else:
                    print(f"[OK] {endpoint}: {model_name}")
        else:
            print(f"[WARNING] {endpoint}: No request body")
    else:
        print(f"[ERROR] {endpoint}: NOT FOUND")

print("\n" + "=" * 80)
print("RESULT:")
print("=" * 80)
if not problematic_schemas:
    print("[SUCCESS] Swagger UI should now display input fields correctly.")
else:
    print("[FAILED] STILL HAVE ISSUES. Need more fixes.")
print("=" * 80)
