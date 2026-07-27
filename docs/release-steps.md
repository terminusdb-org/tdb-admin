# Releasing tdb-admin

Releases are drafted by a GitHub Actions workflow, then published manually after review.

## Steps

1. **Dispatch the workflow**
   - Go to [Actions → Release](https://github.com/terminusdb-org/tdb-admin/actions/workflows/release.yml)
   - Click "Run workflow"
   - Enter the version tag, e.g. `v0.1.1-rc1`
   - Click "Run workflow"

2. **The workflow builds and drafts**
   - Builds the minimized dist (no source maps)
   - Packages it as `tdb-admin-<version>.tar.gz` (e.g. `tdb-admin-0.1.1-rc1.tar.gz`)
   - Creates a **draft** release with the tarball attached
   - The release is not published yet

3. **Review and publish**
   - Go to [Releases](https://github.com/terminusdb-org/tdb-admin/releases)
   - Find the draft release, review the asset
   - Click "Publish release" when satisfied
   - Publishing makes the tarball downloadable and the tag immutable

4. **Update TerminusDB to use the new version**
   - In the terminusdb repo, set `TDB_ADMIN_VERSION` in the `Makefile` to match the tag
   - Example: `TDB_ADMIN_VERSION ?= v0.1.1-rc1`

## Tag naming

Use semantic version tags with a leading `v`:

- `v0.1.0` — stable release
- `v0.1.1-rc1` — release candidate
- `v1.0.0` — major release

The version in the tarball filename strips the `v` prefix (e.g. tag `v0.1.1-rc1` produces `tdb-admin-0.1.1-rc1.tar.gz`).
