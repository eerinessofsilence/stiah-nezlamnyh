Pod::Spec.new do |s|
  s.name = 'GuideEdgeBlur'
  s.version = '0.1.0'
  s.summary = 'A soft UIKit material at the status bar'
  s.homepage = "file://#{File.expand_path('../../../README.md', __dir__)}"
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Стяг незламних'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
