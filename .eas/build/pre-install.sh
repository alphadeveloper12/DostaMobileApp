#!/bin/bash
# Reconstructs Android keystore + credentials.json from EAS secrets before every build.
# iOS credentials are managed by EAS remotely — this script only handles Android.

set -e

# Only run for Android builds
if [ "$EAS_BUILD_PLATFORM" != "android" ]; then
  echo "Skipping keystore restore (platform: $EAS_BUILD_PLATFORM)"
  exit 0
fi

if [ -n "$KEYSTORE_BASE64" ]; then
  echo "Restoring dosta-upload.keystore from EAS secret..."
  echo "$KEYSTORE_BASE64" | base64 -d > "$EAS_BUILD_WORKINGDIR/dosta-upload.keystore"
  echo "Keystore restored ($(wc -c < "$EAS_BUILD_WORKINGDIR/dosta-upload.keystore") bytes)."
else
  echo "KEYSTORE_BASE64 not set — using committed keystore file."
fi

# Write credentials.json for Android signing
cat > "$EAS_BUILD_WORKINGDIR/credentials.json" << EOF
{
  "android": {
    "keystore": {
      "keystorePath": "./dosta-upload.keystore",
      "keystorePassword": "${KEYSTORE_PASSWORD:-dosta123}",
      "keyAlias": "${KEY_ALIAS:-dosta-alias}",
      "keyPassword": "${KEY_PASSWORD:-dosta123}"
    }
  }
}
EOF

echo "credentials.json written for Android."
