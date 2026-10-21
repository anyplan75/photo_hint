import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GeuttaeBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
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
