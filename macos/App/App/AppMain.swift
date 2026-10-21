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

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1200, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "여기야 여기"
        window.minSize = NSSize(width: 960, height: 640)
        let pageColor = NSColor(srgbRed: 8 / 255, green: 18 / 255, blue: 23 / 255, alpha: 1)
        window.backgroundColor = pageColor
        window.delegate = self
        // 예전에 저장한 좁은 창 크기를 다시 열지 않습니다.
        window.isRestorable = false

        let web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        web.navigationDelegate = self
        web.underPageBackgroundColor = pageColor
        // 웹 화면이 창 내용 자체입니다. 하위 뷰로 두면 넓은 창 한가운데에 좁은 칸만 남습니다.
        window.contentView = web
        web.load(URLRequest(url: site))

        self.window = window
        self.webView = web
        fillVisibleScreen(window)
        window.makeKeyAndOrderFront(nil)
        fillVisibleScreen(window)
        if #available(macOS 14.0, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        // 시스템이 창을 띄운 뒤에 크기를 되돌리는 경우가 있어 한 번 더 맞춥니다.
        DispatchQueue.main.async { [weak self] in
            guard let window = self?.window else { return }
            self?.fillVisibleScreen(window)
        }
    }

    /// 지금 포인터가 있는 화면에서, 메뉴 막대와 독 사이의 보이는 영역을 창으로 채웁니다.
    private func fillVisibleScreen(_ window: NSWindow) {
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { $0.frame.contains(mouse) }
            ?? window.screen
            ?? NSScreen.main
            ?? NSScreen.screens.first
        guard let visible = screen?.visibleFrame else { return }
        window.setFrame(visible, display: true)
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
