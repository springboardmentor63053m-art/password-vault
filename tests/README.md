# Disposable PostgreSQL tests

Run from the snapshot repository root with Docker Desktop running. This uses a new container, a new randomly named port and a database named securevault_test. It never uses the application volume.

```powershell
$testName = 'sv-personal-test-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$env:SECUREVAULT_TEST_PG_PASSWORD = [guid]::NewGuid().ToString('N')
docker run --rm -d --name $testName -p '127.0.0.1::5432' -e "POSTGRES_PASSWORD=$env:SECUREVAULT_TEST_PG_PASSWORD" -e POSTGRES_DB=securevault_test postgres:16-alpine | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Test database failed.' }
try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    docker exec $testName pg_isready -h 127.0.0.1 -U postgres -d securevault_test | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'PostgreSQL did not become ready.' }
  docker exec $testName psql -U postgres -d securevault_test -v ON_ERROR_STOP=1 -qc "COMMENT ON DATABASE securevault_test IS 'securevault-isolated-verification'; CREATE ROLE securevault_app;"
  if ($LASTEXITCODE -ne 0) { throw 'Role/marker setup failed.' }
  Get-Content -Raw database/schema.sql | docker exec -i $testName psql -U postgres -d securevault_test -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) { throw 'Test schema failed.' }
  $binding = docker port $testName 5432/tcp | Select-Object -First 1
  $env:SECUREVAULT_TEST_PG_URL = "jdbc:postgresql://$binding/securevault_test"
  mvn.cmd -f backend/pom.xml '-Dtest=*,VaultPostgresIT' test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
} finally {
  docker stop $testName | Out-Null
  Remove-Item Env:SECUREVAULT_TEST_PG_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SECUREVAULT_TEST_PG_PASSWORD -ErrorAction SilentlyContinue
}
```

The integration suite verifies the database name and marker before creating synthetic data. Standard TOTP vectors and test-only passwords in test sources are not deployed credentials. Mail tests use mocks and never send real email.
