# Visitor analytics

Analytics is disabled unless `PLAYBOOK_GA4_ID` is supplied to the build. Use your own GA4 measurement ID for an adaptation. The configured HTTPS publication origin must match the browser origin; development previews and alternate hostnames do not collect.

Google's script loads automatically when an analytics-enabled page opens on the configured publication origin. It adds no reader interface. Analytics cookies expire after 180 days.

Google advertising storage, advertising user data, and personalization remain denied. Google Signals is disabled, `user_data` is explicitly null, and analytics cookies are scoped to the publication hostname. The current page URL excludes query strings and fragments; the referrer is reduced to its origin. Only simple `utm_source`, `utm_medium`, and `utm_campaign` labels are passed as campaign metadata. Worksheet values and search terms are never passed to the instrumentation.

## Events

Each page sends one explicit `page_view` and uses the built-in `content_group` value `Playbook`. Native Google measurement may also report ordinary engagement, scroll, outbound-click and form metadata according to the property settings; our script does not send field values.

| Event | Meaning |
| --- | --- |
| `playbook_scroll_25`, `_50`, `_75`, `_90` | Chapter content has reached that visible depth, once per page. This is not proof of reading. |
| `playbook_read_30s`, `_60s`, `_180s` | Time thresholds while the chapter tab is visible and focused. This is not proof of comprehension. |
| `playbook_tool_start_TOOL` | First edit in a working tool. |
| `playbook_tool_save_TOOL` | The browser successfully saved that tool's notes. |
| `playbook_tool_copy_TOOL` | The clipboard successfully received that tool's notes. |
| `playbook_route_all`, `_purpose`, `_build`, `_evaluate` | A reading-route button was used. |
| `playbook_kabakoo_visit` | A link to Kabakoo's institutional domain was clicked. |

`TOOL` is one of ten fixed identifiers: `problem`, `change`, `readiness`, `sequence`, `architecture`, `mentor`, `onboarding`, `continuation`, `peers`, `experiments`. Event names distinguish tools without requiring custom dimensions in the Analytics account. Failed saves or clipboard operations do not count as successes.

Use the hostname or the built-in Content group dimension to separate this publication from other websites in a shared property. Server statistics and browser statistics have different coverage and should not be expected to match.

## Verify

Run the regular build and reader-tool checks. The analytics browser check additionally verifies automatic page views, fixed tool events, chapter engagement, clean request payloads, operation with unavailable browser storage, unchanged page layout, and preview isolation. See [browser verification](browser-checks.md).

When validating against Google, distinguish an accepted collection request from data appearing in a property's reports. Report access and administration require account permissions separate from the public measurement ID.
