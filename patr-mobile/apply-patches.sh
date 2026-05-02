#!/bin/bash
set -e
cd /Users/ravikumarsoni/Downloads/twitter-clone-frontend-fixed/patr-mobile
echo "Applying all patches..."

# 1. packages_config.rb (both copies)
for dir in \
  "node_modules/expo-modules-autolinking/scripts/ios" \
  "node_modules/expo/node_modules/expo-modules-autolinking/scripts/ios"; do
  cat > "$dir/packages_config.rb" << 'RUBY'
require 'singleton'
module Expo
  class PackagesConfig
    include Singleton
    attr_accessor :coreFeatures
    def initialize
      @coreFeatures = []
    end
    def try_link_with_prebuilt_xcframework(spec)
      return false
    end
  end
end
RUBY
  echo "✅ packages_config.rb: $dir"
done

# 2. All Swift patches
python3 - << 'PYEOF'
import os

base = "/Users/ravikumarsoni/Downloads/twitter-clone-frontend-fixed/patr-mobile/node_modules/"

patches = {
    "expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift": [
        (b': ExpoView, @MainActor AnyExpoSwiftUIHostingView {', b': ExpoView, AnyExpoSwiftUIHostingView {')
    ],
    "expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIVirtualView.swift": [
        (b': @MainActor ExpoSwiftUI.ViewWrapper {', b': ExpoSwiftUI.ViewWrapper {')
    ],
    "expo-modules-core/ios/Core/Views/ViewDefinition.swift": [
        (b': @MainActor AnyArgument {', b': AnyArgument {')
    ],
    "expo/ios/Fetch/ExpoFetchCustomExtension.swift": [
        (b'NSURLSessionConfigurationProvider', b'((URLSessionConfiguration) -> URLSessionConfiguration)')
    ],
    "expo/ios/Fetch/ExpoFetchModule.swift": [
        (b'NSURLSessionConfigurationProvider', b'((URLSessionConfiguration) -> URLSessionConfiguration)'),
        (b'if let urlSessionConfigurationProvider, let concreteConfig = urlSessionConfigurationProvider() {\n      config = concreteConfig', b'if let urlSessionConfigurationProvider {\n      config = urlSessionConfigurationProvider(URLSessionConfiguration.default)'),
    ],
    "expo-image-picker/ios/ImagePickerPermissionRequesters.swift": [
        (b'RCTFatal(RCTErrorWithMessage(', b'_ = ('),
    ],
    "expo-image-picker/ios/MediaHandler.swift": [
        (b'    let utType: UTType? = if #available(iOS 26.0, *) {\n      asset?.contentType ?? UTType(filenameExtension: fileExtension)\n    } else {\n      UTType(filenameExtension: fileExtension)\n    }',
         b'    let utType: UTType? = UTType(filenameExtension: fileExtension)'),
        (b'    let utType: UTType? = if #available(iOS 26.0, *) {\n      resource.contentType\n    } else {\n      UTType(resource.uniformTypeIdentifier) ?? UTType(filenameExtension: fileExtension)\n    }',
         b'    let utType: UTType? = UTType(resource.uniformTypeIdentifier) ?? UTType(filenameExtension: fileExtension)'),
    ],
}

prefixes = [base, base + "expo/node_modules/"]

for prefix in prefixes:
    for rel, replacements in patches.items():
        filepath = prefix + rel
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'rb') as f:
            content = f.read()
        changed = False
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                changed = True
                print(f"✅ {filepath.replace(base, '')}")
        if changed:
            with open(filepath, 'wb') as f:
                f.write(content)

print("All Swift patches done!")
PYEOF

echo "All patches applied! ✅"
