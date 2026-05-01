#!/bin/bash
# Reconstructs keystore + credentials.json from EAS secrets before every build.
# This prevents wrong-key errors — the correct dosta-upload.keystore is always used.

set -e

if [ -n "$KEYSTORE_BASE64" ]; then
  echo "Restoring dosta-upload.keystore from EAS secret..."
  echo "$KEYSTORE_BASE64" | base64 -d > "$EAS_BUILD_WORKINGDIR/dosta-upload.keystore"
  echo "Keystore restored."
else
  echo "KEYSTORE_BASE64 not set — using committed keystore file."
fi

# Always write credentials.json from env vars (or fallback to known values)
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

echo "credentials.json written."
