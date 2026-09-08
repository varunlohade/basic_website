# Security and code-quality review

Reviewed 2026-09-08. Scope: current repository at base commit
`9bd9ad8443b5c82f035e462fbebbeee59c6c1320`, the animated portfolio port, dependency
lockfile, generated static output and browser behavior. This is a code review,
not a penetration test or a guarantee of no vulnerabilities.

## Findings addressed

| Finding                                                                                                                                                  | Change                                                                                            | Evidence                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Existing lockfile reported 11 vulnerable packages (8 high, 2 moderate, 1 low). Many advisories concern development/SSR features, not this static output. | Upgraded Astro and MDX together, migrated content collections and pinned Three.js.                | Updated `npm audit` reports 0 vulnerabilities, including dev dependencies.                             |
| Shared canvas texture sources overwrote the backdrop, producing a black scene.                                                                           | Each canvas gets its own `Texture`/`Source`.                                                      | Regression test changes one texture and verifies the others remain intact.                             |
| Previous delivery contained copied minified vendor code, obsolete video/images and unformatted application modules.                                      | Import the pinned Three.js dependency; retain only four artwork layers; format maintained source. | Production build bundles the dependency; no legacy assets or vendored Three.js copied to this repo.    |
| External font requests and no restrictive content policy.                                                                                                | Use system-font fallbacks, same-origin script policy, and security-header configuration.          | Browser loads the scene with no new application/CSP errors; generated HTML contains no inline scripts. |
| Animation failure could leave active observers/repeated rendering attempts.                                                                              | Stop scheduling and disconnect resize work on fatal errors; preserve poster.                      | Reviewed failure paths; visibility and reduced-motion handling retained.                               |
| Narrow ignore rules could accidentally include other environment files.                                                                                  | Ignore `.env.*`, private-key extensions and local build products.                                 | Source/output pattern scan found no secret-pattern matches.                                            |

## Validation

- `ASTRO_TELEMETRY_DISABLED=1 npm run build`: success, three static routes:
  `/`, `/blog/`, `/blog/hello/`.
- `npm test`: three passing regression tests covering independent texture
  sources, continuous reachable arm motion and pencil transfer/write contact.
- `npm audit --json`: zero known vulnerabilities at review time.
- Source and static-output scans: no private-key/token patterns and no `eval`,
  `new Function`, `innerHTML`, `document.write`, or `set:html` application sinks.
- Browser inspection of the exact built output: revised headline, city, river,
  robot and laptop render. No new application or CSP errors observed. Browser
  extension logs are outside the application's control.
- `git diff --check`: no whitespace errors.

## Boundaries and remaining limits

- No backend, authentication, database, payments, forms or user-upload pipeline
  is included. There are no app secrets to configure or expose to the client.
- Repository-owned MDX is executable build input. Do not accept untrusted MDX
  through uploads or an unreviewed content integration.
- The CSP permits inline CSS for code highlighting. It does not permit inline
  JavaScript or remote scripts. Framing protection requires response headers;
  the meta CSP alone cannot supply it.
- `_headers` enforcement, TLS, custom-domain configuration, GitHub permissions
  and account security depend on the chosen host. Actual custom-domain headers
  were not verified because the GitHub push is blocked.
- Browser QA used the supported internal preview, not the production domain.
  Mobile-device performance and every browser/GPU combination were not tested.
- Dependency audits are point-in-time advisory checks. Rerun them before release.

## References

- Astro development-server advisory:
  https://github.com/withastro/astro/security/advisories/GHSA-x3h8-62x9-952g
- Astro migration guidance:
  https://docs.astro.build/en/guides/upgrade-to/v7/
- Current content-collection API:
  https://docs.astro.build/en/guides/content-collections/
