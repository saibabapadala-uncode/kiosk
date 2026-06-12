// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Starprinterplugin",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "Starprinterplugin",
            targets: ["StarPrinterReceiptPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "StarPrinterReceiptPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/StarPrinterReceiptPlugin"),
        .testTarget(
            name: "StarPrinterReceiptPluginTests",
            dependencies: ["StarPrinterReceiptPlugin"],
            path: "ios/Tests/StarPrinterReceiptPluginTests")
    ]
)