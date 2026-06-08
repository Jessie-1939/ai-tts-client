# Publishing Guide

## GitHub release checklist
- Update `README.md` and keep screenshots in sync with the UI
- Keep `LICENSE` in the repository root
- Tag a release and attach the source archive if needed
- Avoid vendor-brand claims unless they are part of the supported provider list

## Microsoft Edge Add-ons / Microsoft Store checklist
- Keep the extension permissions minimal
- Provide a clear privacy policy URL
- Include store-ready screenshots and a concise description
- Ensure the extension name, icon, and listing copy are neutral and not misleading
- Verify that all external links are valid and that the package loads correctly in Edge

## Notes
- This extension sends text to the configured TTS provider when generating speech
- API credentials are stored locally in the browser
- If you add new providers later, update the README and privacy policy together
