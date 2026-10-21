import Darwin
import UIKit
import WebKit
import Capacitor

@_silgen_name("geuttae_cocoa_rect")
private func geuttaeCocoaRect(_ object: UnsafeMutableRawPointer, _ name: UnsafePointer<CChar>) -> CGRect

@_silgen_name("geuttae_set_cocoa_frame")
private func geuttaeSetCocoaFrame(_ window: UnsafeMutableRawPointer, _ frame: CGRect)

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GeuttaeBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        fillMacWindow(windowScene)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        guard let windowScene = scene as? UIWindowScene else { return }
        fillMacWindow(windowScene)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// 맥에서 아이폰 앱으로 열릴 때만 창을 키웁니다. 아이폰·아이패드에서는 아무 것도 하지 않습니다.
    private func fillMacWindow(_ windowScene: UIWindowScene) {
        guard ProcessInfo.processInfo.isiOSAppOnMac else { return }
        let until = Date().addingTimeInterval(4)
        if until > macFillUntil { macFillUntil = until }
        MacHostedWindow.fill(windowScene)
        for delay in [0.3, 1.0, 2.0, 3.5] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self, weak windowScene] in
                guard let self, let windowScene, Date() < self.macFillUntil else { return }
                MacHostedWindow.fill(windowScene)
            }
        }
    }

    private var macFillUntil = Date.distantPast
}

/// 맥의 메뉴 막대와 독 사이로 아이폰 앱 창을 맞춥니다.
private enum MacHostedWindow {
    static func fill(_ windowScene: UIWindowScene) {
        guard ProcessInfo.processInfo.isiOSAppOnMac else { return }
        loadAppKit()
        guard let screen = primaryScreen() else { return }
        let cocoaFrame = cocoaRect(screen, "frame")
        let visible = cocoaRect(screen, "visibleFrame")
        guard cocoaFrame.width > 1, cocoaFrame.height > 1, visible.width > 1, visible.height > 1 else { return }

        for window in macWindows() {
            setCocoaFrame(window, visible)
        }
        guard #available(iOS 16.0, *) else { return }
        if let restrictions = windowScene.sizeRestrictions {
            let minSize = CGSize(width: min(960, visible.width), height: min(640, visible.height))
            restrictions.minimumSize = minSize
            restrictions.maximumSize = CGSize(width: max(visible.width, minSize.width), height: max(visible.height, minSize.height))
        }
        let systemY = (cocoaFrame.origin.y + cocoaFrame.height) - (visible.origin.y + visible.height)
        let systemFrame = CGRect(
            x: visible.origin.x - cocoaFrame.origin.x,
            y: systemY,
            width: visible.width,
            height: visible.height
        )
        let preferences = UIWindowScene.GeometryPreferences.Mac()
        preferences.systemFrame = systemFrame
        windowScene.requestGeometryUpdate(preferences) { _ in }
    }

    private static func loadAppKit() {
        _ = dlopen("/System/Library/Frameworks/AppKit.framework/AppKit", RTLD_LAZY)
    }

    private static func classObject(_ name: String) -> NSObject? {
        guard let metatype = NSClassFromString(name) else { return nil }
        return unsafeBitCast(metatype, to: NSObject.self)
    }

    private static func primaryScreen() -> NSObject? {
        guard let screenClass = classObject("NSScreen") else { return nil }
        let selector = NSSelectorFromString("screens")
        guard screenClass.responds(to: selector),
              let unmanaged = screenClass.perform(selector) else { return nil }
        let screens = unmanaged.takeUnretainedValue() as? [NSObject]
        return screens?.first
    }

    private static func macWindows() -> [NSObject] {
        guard let appClass = classObject("NSApplication") else { return [] }
        let sharedSelector = NSSelectorFromString("sharedApplication")
        guard appClass.responds(to: sharedSelector),
              let app = appClass.perform(sharedSelector)?.takeUnretainedValue() as? NSObject else { return [] }
        var found: [NSObject] = []
        if let key = app.perform(NSSelectorFromString("keyWindow"))?.takeUnretainedValue() as? NSObject {
            found.append(key)
        }
        if let windows = app.perform(NSSelectorFromString("windows"))?.takeUnretainedValue() as? [NSObject] {
            for window in windows where !found.contains(where: { $0 === window }) {
                found.append(window)
            }
        }
        return found
    }

    private static func cocoaRect(_ object: NSObject, _ selectorName: String) -> CGRect {
        let pointer = Unmanaged.passUnretained(object).toOpaque()
        return selectorName.withCString { geuttaeCocoaRect(pointer, $0) }
    }

    private static func setCocoaFrame(_ window: NSObject, _ frame: CGRect) {
        guard window.responds(to: NSSelectorFromString("setFrame:display:")) else { return }
        let pointer = Unmanaged.passUnretained(window).toOpaque()
        geuttaeSetCocoaFrame(pointer, frame)
    }
}

/// 웹사이트 주소는 그대로 두고, 카메라 요청만 이 앱이 허용합니다.
class GeuttaeBridgeViewController: CAPBridgeViewController {
    private var cameraDelegate: CameraCaptureUIDelegate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView, let current = webView.uiDelegate else { return }
        let cameraDelegate = CameraCaptureUIDelegate(next: current)
        self.cameraDelegate = cameraDelegate
        webView.uiDelegate = cameraDelegate
    }
}

/// 웹뷰가 카메라를 물을 때 허용합니다. 그 밖의 웹뷰 동작은 기존 대리자에게 넘깁니다.
final class CameraCaptureUIDelegate: NSObject, WKUIDelegate {
    private weak var next: (NSObject & WKUIDelegate)?

    init(next: WKUIDelegate) {
        self.next = next as? NSObject & WKUIDelegate
        super.init()
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) {
            return true
        }
        return next?.responds(to: aSelector) ?? false
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let next, next.responds(to: aSelector) {
            return next
        }
        return super.forwardingTarget(for: aSelector)
    }

    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        switch type {
        case .camera, .cameraAndMicrophone:
            decisionHandler(.grant)
        case .microphone:
            decisionHandler(.deny)
        @unknown default:
            decisionHandler(.deny)
        }
    }

    func webView(
        _ webView: WKWebView,
        requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }
}
