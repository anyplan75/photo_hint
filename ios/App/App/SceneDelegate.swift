import UIKit
import WebKit
import Capacitor

@_silgen_name("geuttae_apply_visible_frame")
private func geuttaeApplyVisibleFrame()

@_silgen_name("geuttae_visible_system_frame")
private func geuttaeVisibleSystemFrame() -> CGRect

@_silgen_name("geuttae_request_system_frame")
private func geuttaeRequestSystemFrame(_ scene: UIWindowScene, _ x: Double, _ y: Double, _ width: Double, _ height: Double)

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GeuttaeBridgeViewController()
        if ProcessInfo.processInfo.isiOSAppOnMac, let restrictions = windowScene.sizeRestrictions {
            restrictions.minimumSize = CGSize(width: 960, height: 640)
            restrictions.maximumSize = CGSize(width: 8000, height: 8000)
        }
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        guard let windowScene = scene as? UIWindowScene else { return }
        guard window != nil else { return }
        fillMacWindow(windowScene)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// 맥에서 아이폰 앱으로 열릴 때만, 창이 생긴 뒤에 크기를 맞춥니다.
    private func fillMacWindow(_ windowScene: UIWindowScene) {
        guard ProcessInfo.processInfo.isiOSAppOnMac else { return }
        guard window != nil else { return }
        MacHostedWindow.fill(windowScene)
        guard !didScheduleMacFill else { return }
        didScheduleMacFill = true
        for delay in [0.6, 1.6, 3.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self, weak windowScene] in
                guard let self, let windowScene, self.window != nil else { return }
                MacHostedWindow.fill(windowScene)
            }
        }
    }

    private var didScheduleMacFill = false

}

/// 맥의 메뉴 막대와 독 사이로 아이폰 앱 창을 맞춥니다. 화면 정보를 못 읽으면 그냥 둡니다.
private enum MacHostedWindow {
    static func fill(_ windowScene: UIWindowScene) {
        guard ProcessInfo.processInfo.isiOSAppOnMac else { return }
        guard windowScene.windows.isEmpty == false else { return }
        let systemFrame = geuttaeVisibleSystemFrame()
        guard systemFrame.width > 2, systemFrame.height > 2 else { return }
        if let restrictions = windowScene.sizeRestrictions {
            restrictions.minimumSize = systemFrame.size
            restrictions.maximumSize = CGSize(width: max(systemFrame.width, 8000), height: max(systemFrame.height, 8000))
        }
        if #available(iOS 16.0, *) {
            geuttaeRequestSystemFrame(windowScene, systemFrame.origin.x, systemFrame.origin.y, systemFrame.width, systemFrame.height)
        }
        geuttaeApplyVisibleFrame()
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
