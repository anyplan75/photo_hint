#include <CoreGraphics/CGGeometry.h>
#include <objc/message.h>
#include <objc/runtime.h>

// 맥 창의 위치는 구조체라서, 스위프트의 일반 호출로는 값을 주고받을 수 없습니다.
// 아이폰에서는 이 함수를 부르지 않습니다.

CGRect geuttae_cocoa_rect(id object, const char *name) {
    SEL selector = sel_registerName(name);
    CGRect (*send)(id, SEL) = (CGRect (*)(id, SEL))objc_msgSend;
    return send(object, selector);
}

void geuttae_set_cocoa_frame(id window, CGRect frame) {
    SEL selector = sel_registerName("setFrame:display:");
    void (*send)(id, SEL, CGRect, BOOL) = (void (*)(id, SEL, CGRect, BOOL))objc_msgSend;
    send(window, selector, frame, YES);
}
