# Make uploading homework as easy as scanning

The add-homework page already has an "Upload files" button, but everything leading to it says "Scan", and once pages are added, the only way to add more is the camera. This plan makes uploading a clear, equal option.

## Changes
- **Home page:** the main card becomes "Add This Week's Homework" with two buttons: "Take photos" and "Upload files". "Upload files" opens the file picker right away. The "New week from your teacher?" card reads "Scan or upload next week's homework".
- **Bottom menu:** "Scan" becomes "Add" (same icon spot).
- **Add homework page:** title becomes "Add This Week's Homework", and the text mentions both photos and files. Under the page list, "Add another page" splits into "Take another photo" and "Upload more files".
- Accepted files stay the same: photos/screenshots, PDFs and text files, up to 20MB each, any mix in one week.

## Technical details
- `home.tsx`: link to `/scan?mode=upload` for the upload button; `scan.tsx` reads the `mode` search param and opens the file input on mount (falls back to showing the button if the browser blocks the auto-open).
- `route.tsx` nav label update; `scan.tsx` copy and head titles updated.
- No changes to how files are stored or analyzed.
