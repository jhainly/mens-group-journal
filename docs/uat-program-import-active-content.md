# UAT: Program Import and Active Content Loading

## Test Case ID

UAT-IMPORT-001

## Purpose

Verify that an admin can import a YAML week, preview it, import it to a selected group, and that members of that same group can load the imported content on the dashboard and day journal screens, including show/hide visibility and archived read-only behavior.

## Scope

This test covers:

- Admin YAML import preview.
- Week import to a selected group, visible immediately or hidden.
- Group active program pointer update.
- Member dashboard loading from the persisted active program snapshot.
- Member day view loading from the persisted active program snapshot.

This test does not cover:

- Journal encryption save/load.
- PDF export.
- Leaderboard scoring accuracy.

## Preconditions

- The app is deployed or running locally at `http://localhost:3000`.
- Amplify sandbox or AWS backend is running and `amplify_outputs.json` points to that backend.
- Tester has one Cognito account in the `ADMINS` or `LEADERS` group.
- Tester has access to `/admin/import`.
- At least one group exists.
- The admin account is a member or leader of the group being tested.
- The browser session is signed in as the admin user.

## Test Data

Use a valid one-week YAML program with:

- `program.id`
- `program.title`
- `program.version`
- `weeks`
- 1 week
- 7 days
- sections with unique prompt IDs
- embedded scripture text
- point values

Record these values before testing:

- Test group name:
- Test group ID, if visible:
- Expected program title:
- Expected week title:
- Expected day 1 title:

## Steps and Expected Results

| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Sign in as an admin or leader. | User is authenticated and top navigation shows admin access. |
| 2 | Open `/admin/programs/import`. | Import page loads with YAML source panel and preview panel. |
| 3 | Paste the test YAML into the Program content field. | YAML remains editable and no validation result is shown yet. |
| 4 | Click `Preview program`. | Preview panel renders the program title, week/day counts, week selector, day selector, and rendered sections. |
| 5 | Confirm the selected group is the intended test group and is not archived. | Group checkbox for the intended group is checked; archived groups are disabled. |
| 6 | Leave `Make imported weeks visible to group members immediately` checked and click `Import weeks`. | Page displays `Published 1 week to 1 group.` |
| 7 | If an error appears, copy the exact error text. | Test fails. Record the error under Actual Result. Current known failure: `Variable 'content' has an invalid value.` |
| 8 | Open `/dashboard`. | Dashboard loads without server error. |
| 9 | If more than one group exists, select the same group used during import from the Groups switcher. | Dashboard switches to the selected group; entries read `Program - Group`. |
| 10 | Review the program section of the dashboard. | Dashboard shows the imported program title, selected week title, week summary, days, and available points from the persisted snapshot. |
| 11 | Open day 1 from the dashboard. | Day journal page opens for the imported program's day 1 content. |
| 12 | Compare day title, sections, scripture, prompts, breath prayers, completion checkboxes, and point values to the imported YAML. | Day journal content matches the imported YAML exactly; zero-point sections show no checkbox. |
| 13 | In `/admin/groups/<groupId>`, click `Hide week` for the imported week, then reload `/dashboard`. | The week disappears from the member's week selector; clicking `Show week` brings it back. |
| 14 | In `/admin/groups/<groupId>`, click `Archive group` and confirm, then open the day journal as a member. | Switcher label ends with `(Archived)`, an archived notice is shown, all inputs are disabled, and no save status appears. `Unarchive group` restores editing. |

## Pass Criteria

The test passes only if:

- Preview renders successfully.
- Import returns `Published 1 week to 1 group.`
- Dashboard loads the selected group's imported weeks from the persisted week records.
- Day journal loads the same persisted program content.
- No sample program content appears unless that exact sample content was imported.
- Hide/show and archive/unarchive behave as described in steps 13-14.

## Fail Criteria

The test fails if:

- Import returns an error.
- Dashboard says no active program was published after a successful import.
- Dashboard shows sample content instead of imported content.
- Day journal 404s for a valid imported week/day.
- Day journal content does not match the imported YAML.

## Actual Result

Date:

Tester:

Environment:

Result: Pass / Fail

Observed error, if any:

```text
Variable 'content' has an invalid value.
```

Notes:

## Defect Notes

If the current error reproduces, likely investigation areas are:

- `ProgramSnapshot.content` serialization format expected by Amplify Data.
- Whether `a.json()` accepts the client payload shape being sent.
- Whether the publish mutation should send `content: JSON.stringify(preview.program)` instead of the raw object.
- Whether the loader should parse stringified content before validating with `programSchema`.
