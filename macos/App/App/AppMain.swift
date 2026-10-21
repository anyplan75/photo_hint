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
        let defaults = UserDefaults.standard
        // 사용자가 직접 열 때도 예전 창 크기를 복원하지 않습니다.
        defaults.set(true, forKey: "ApplePersistenceIgnoreState")
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix("NSWindow Frame") {
            defaults.removeObject(forKey: key)
        }
        defaults.synchronize()
        let saved = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
            .appendingPathComponent("Library/Saved Application State", isDirectory: true)
        try? FileManager.default.removeItem(at: saved)

        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = appDelegate
        app.run()
    }
}

/// 웹 화면을 창 내용의 네 변에 붙입니다. 자동 레이아웃은 쓰지 않습니다.
final class EdgePinnedWebHost: NSView {
    let webView: WKWebView

    init(webView: WKWebView) {
        self.webView = webView
        super.init(frame: .zero)
        autoresizesSubviews = true
        webView.autoresizingMask = [.width, .height]
        addSubview(webView)
    }

    required init?(coder: NSCoder) { nil }

    override func layout() {
        super.layout()
        webView.frame = bounds
    }

    override func resizeSubviews(withOldSize oldSize: NSSize) {
        super.resizeSubviews(withOldSize: oldSize)
        webView.frame = bounds
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var applyingFrame = false
    private var userResized = false

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
        window.isRestorable = false
        window.setFrameAutosaveName("")

        let web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        web.navigationDelegate = self
        web.underPageBackgroundColor = pageColor
        let host = EdgePinnedWebHost(webView: web)
        host.wantsLayer = true
        host.layer?.backgroundColor = pageColor.cgColor
        window.contentView = host
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
        // 복원이나 웹 화면이 창을 줄이면, 사용자가 직접 크기 조절하기 전에 다시 펼칩니다.
        for delay in [0.0, 0.3, 1.0, 2.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self, let window = self.window, !self.userResized else { return }
                self.fillVisibleScreen(window)
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix("NSWindow Frame") {
            defaults.removeObject(forKey: key)
        }
        defaults.synchronize()
    }

    private func sameFrame(_ a: NSRect, _ b: NSRect) -> Bool {
        abs(a.origin.x - b.origin.x) < 2
            && abs(a.origin.y - b.origin.y) < 2
            && abs(a.size.width - b.size.width) < 2
            && abs(a.size.height - b.size.height) < 2
    }

    /// 창이 올라간 화면에서, 메뉴 막대와 독 사이의 보이는 영역을 채웁니다.
    private func fillVisibleScreen(_ window: NSWindow) {
        let screen = window.screen ?? NSScreen.main ?? NSScreen.screens.first
        guard let visible = screen?.visibleFrame else { return }
        guard !sameFrame(window.frame, visible) else { return }
        applyingFrame = true
        window.setFrame(visible, display: true)
        applyingFrame = false
        if let host = window.contentView {
            webView?.frame = host.bounds
        }
    }

    func windowDidResize(_ notification: Notification) {
        guard !applyingFrame, !userResized, let window, !window.inLiveResize else { return }
        fillVisibleScreen(window)
    }

    func windowDidEndLiveResize(_ notification: Notification) {
        userResized = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let window, !userResized else { return }
        fillVisibleScreen(window)
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
