# Let phones pick any common homework file

## Why files look greyed out
The upload picker only allows photos, PDFs and plain text files. On your phone, everything else (Word, Excel, Google Docs/Sheets, PowerPoint) shows up greyed out, so you can't select it.

## Changes
- **Allowed files:** photos and screenshots (including iPhone HEIC), PDF, Word (.doc, .docx), Excel (.xls, .xlsx), CSV, PowerPoint (.pptx), plain text, RTF, and OpenDocument files. Google Docs, Sheets and Slides work when picked from the Google Drive app, because Drive hands them over as Word, Excel, PowerPoint or PDF.
- **How they're read:** for Word, Excel, PowerPoint, CSV and RTF files, the app pulls out the text (tables included) on your phone before uploading. The AI then reads that text alongside any photos and PDFs from the same week. The original file is saved too.
- **iPhone photos (HEIC):** turned into normal photos before upload.
- **Old .doc / .xls files:** the app tries to read them. If it can't, you'll see a clear message asking you to save the file as a PDF. Files never fail without telling you.
- Limit stays at 20MB per file, and you can mix any file types in one week.
- The note under the buttons changes to "Photos, PDFs, Word, Excel, PowerPoint, Google Docs/Sheets · up to 20MB each".

## Technical details
- `scan.tsx`: widen `accept` to include extensions plus MIME types (`.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.rtf,.odt,.ods,.odp,.txt,.heic,.heif`). iOS needs extensions to enable these files. Validate by extension as well as MIME type, since phones often report an empty type.
- New `src/lib/extract-text.ts` (browser only, loaded on demand): docx, pptx, odt and odp text via `jszip` XML parsing; xlsx, xls, ods and csv via SheetJS (`xlsx`), giving one text table per sheet; RTF stripped to plain text. The extracted text is uploaded as a `.txt` sidecar document, which the existing analyzer already accepts, and the original goes into the homework bucket.
- HEIC to JPEG conversion with `heic2any`, applied before `downscale`.
- No database or analyzer schema changes. Add a small unit test that checks text is extracted from a sample docx and a sample csv.
