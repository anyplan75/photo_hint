import Cocoa
import WebKit

/// 앱이 꺼지지 않도록 대리자를 여기에 붙잡아 둡니다.
private let appDelegate = AppDelegate()

/// 맥의 큰 창에서, 이미 만든 웹 화면을 그대로 엽니다.
@main
enum AppMain {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = appDelegate
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let width = min(1440, max(960, screen.width * 0.92))
        let height = min(900, max(640, screen.height * 0.9))
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: width, height: height),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "그때 그자리"
        window.minSize = NSSize(width: 960, height: 640)
        window.setFrameAutosaveName("GeuttaeMainWindow")
        window.backgroundColor = NSColor(srgbRed: 16 / 255, green: 20 / 255, blue: 28 / 255, alpha: 1)

        let web = WKWebView(frame: window.contentView?.bounds ?? .zero, configuration: WKWebViewConfiguration())
        web.autoresizingMask = [.width, .height]
        window.contentView?.addSubview(web)

        if let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public") {
            web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        } else {
            web.loadHTMLString(
                "<p style='font-family:sans-serif;padding:24px'>화면 파일을 찾지 못했습니다. 터미널에서 npm run build:mac 을 다시 실행하세요.</p>",
                baseURL: nil
            )
        }

        window.center()
        window.makeKeyAndOrderFront(nil)
        if #available(macOS 14.0, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        self.window = window
        self.webView = web
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
