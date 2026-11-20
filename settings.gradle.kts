pluginManagement { repositories { gradlePluginPortal(); mavenCentral() } }
rootProject.name = "diar-web"
include(":shared")
project(":shared").projectDir = file("domain/shared")
