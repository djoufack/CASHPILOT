# Enterprise Load Tests

This repository ships two k6 entrypoints for enterprise readiness checks.

## Scripts

- `scripts/load-test-cashpilot.js`
- `scripts/load-test-soak.js`

Both scripts accept the same base URL convention:

- `BASE_URL`
- `K6_BASE_URL`
- fallback: `https://cashpilot.tech`

## Local Runs

Use the official k6 container so the same runtime is used locally and in CI.

```bash
docker run --rm \
  -e BASE_URL=https://cashpilot.tech \
  -e K6_PROFILE=light \
  -e LOAD_TEST_REPORT_DIR=/work/artifacts/load-tests \
  -v "$PWD:/work" \
  -w /work \
  grafana/k6:0.53.0 run scripts/load-test-cashpilot.js
```

```bash
docker run --rm \
  -e BASE_URL=https://cashpilot.tech \
  -e K6_TARGET_VUS=100 \
  -e K6_RAMP_UP_MINUTES=2 \
  -e K6_SOAK_MINUTES=26 \
  -e K6_RAMP_DOWN_MINUTES=2 \
  -e LOAD_TEST_REPORT_DIR=/work/artifacts/load-tests \
  -v "$PWD:/work" \
  -w /work \
  grafana/k6:0.53.0 run scripts/load-test-soak.js
```

## Thresholds

### Peak / light test

- `http_req_duration`: `p(95) < 3000ms`, `p(99) < 5000ms`
- `http_req_failed`: `< 5%`
- `errors`: `< 5%`

### Soak test

- `http_req_duration`: `p(95) < 2000ms`, `p(99) < 5000ms`
- `http_req_failed`: `< 2%`
- `app_errors`: `< 1%`

## CI Workflow

The workflow file is `.github/workflows/load-tests.yml`.

- `schedule`: weekly light run against production
- `workflow_dispatch`: manual selection of script, profile, and base URL

No secrets are required. The workflow targets the public production URL by default.

## Outputs

Each run writes readable reports under:

- `artifacts/load-tests/*.txt`
- `artifacts/load-tests/*.json`

Those artifacts are uploaded by GitHub Actions.
