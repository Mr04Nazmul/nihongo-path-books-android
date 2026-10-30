# Play Console artwork

Phone-only asset pack for Nihongo Path Books1.5.2, current green/cream native UI. The unapproved Figma theme is not integrated.

- Icon512x512 RGBA PNG, exported from the existing native drawable/ic_books.xml.
- Feature graphic1024x500 RGB PNG, editable SVG source.
- Four actual1080x1920 phone captures: library, rewards, login, signup.
- Upload guide includes exact slots and alt text.

Requirements checked against https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB on30October2026 JST. No rankings, ratings, download counts, revenue claims or fictional user balances are shown. No device-specific tablet/TV screenshots are invented.

`python3 android-app/store-listing/source/build_graphics.py /path/to/output` exports icon and feature graphic (requires Inkscape and Pillow). The sources retain the same icon and app colours. Actual screens are captured by ProtectionTest and the android.yml workflow at1080x1920. FLAG_SECURE is asserted and retained; only the test runner draws the actual view to a private PNG, without disabling the production window flag.

Capture source f838e21b4a8322ed54caa50954d07baa8b0874a7, workflow40973377212. The application code is unchanged from the delivered owner-AdMob1.5.2; changes for this task are artwork, instrumentation and export workflow only. These images do not establish Play publication or unrestricted AdMob approval.

Final verification: all SIX jobs of run40973377212 PASSED. Chosen screenshots came from API35 artifact12942300299 and were individually inspected at1080x1920. RGB conversion only; no screenshot UI edits or enlargement. Asset pixel sizes, PNG colour modes, icon size limit and SHA256s are recorded in asset-manifest.json.
