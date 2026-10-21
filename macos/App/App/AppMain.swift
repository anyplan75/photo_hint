import Cocoa
import WebKit

/// 앱이 꺼지지 않도록 대리자를 여기에 붙잡아 둡니다.
private let appDelegate = AppDelegate()

/// 로그인 주소는 웹사이트와 같습니다. file 주소에서는 Firebase 로그인이 막힙니다.
private let site = URL(string: "https://anyplan75.github.io/photo_hint/")!

/// 맥에서 웹사이트를 엽니다. 창은 보이는 화면을 끝까지 채우고, 페이지 배치는 그 주소에 있습니다.
@main
enum AppMain {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = appDelegate
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let window = NSWindow(
            contentRect: screen,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "여기야 여기"
        window.minSize = NSSize(width: 960, height: 640)
        window.backgroundColor = NSColor(srgbRed: 16 / 255, green: 20 / 255, blue: 28 / 255, alpha: 1)
        // 메뉴 막대와 독 사이의 보이는 화면을 가로·세로로 끝까지 채웁니다.
        // 예전 이름에 저장된 1440×900 창은 다시 열지 않습니다.
        window.setFrame(screen, display: true)
        window.setFrameAutosaveName("GeuttaeMainWindowFill")

        let web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        web.navigationDelegate = self
        web.translatesAutoresizingMaskIntoConstraints = false
        web.underPageBackgroundColor = window.backgroundColor
        if let content = window.contentView {
            content.addSubview(web)
            NSLayoutConstraint.activate([
                web.leadingAnchor.constraint(equalTo: content.leadingAnchor),
                web.trailingAnchor.constraint(equalTo: content.trailingAnchor),
                web.topAnchor.constraint(equalTo: content.topAnchor),
                web.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            ])
        }
        web.load(URLRequest(url: site))

        window.makeKeyAndOrderFront(nil)
        if #available(macOS 14.0, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        self.window = window
        self.webView = web
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showOffline(webView, error: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showOffline(webView, error: error)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    /// 연결이 끊긴 경우에만 짧은 안내를 보여 창이 하얗게 남지 않게 합니다.
    private func showOffline(_ webView: WKWebView, error: Error) {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return
        }
        webView.loadHTMLString(
            "<p style='font-family:sans-serif;padding:24px;color:#f6f1e6;background:#10141c'>웹사이트에 연결하지 못했습니다. 인터넷을 확인한 뒤 앱을 다시 여세요.</p>",
            baseURL: nil
        )
    }
}
