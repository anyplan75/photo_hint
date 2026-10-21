#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <dlfcn.h>
#import <objc/runtime.h>

// 맥에서 아이폰 앱으로 열릴 때만 씁니다. 화면 정보나 창이 없으면 아무 것도 하지 않습니다.

static BOOL geuttae_appkit_ready(void) {
    static int state = 0;
    if (state != 0) {
        return state > 0;
    }
    void *handle = dlopen("/System/Library/Frameworks/AppKit.framework/AppKit", RTLD_LAZY);
    Class screenClass = NSClassFromString(@"NSScreen");
    Class appClass = NSClassFromString(@"NSApplication");
    state = (handle != NULL && screenClass != Nil && appClass != Nil) ? 1 : -1;
    return state > 0;
}

static id geuttae_object(id target, NSString *name) {
    if (target == nil || name.length == 0) {
        return nil;
    }
    SEL selector = NSSelectorFromString(name);
    if (selector == NULL || ![target respondsToSelector:selector]) {
        return nil;
    }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    id value = [target performSelector:selector];
#pragma clang diagnostic pop
    return value;
}

static BOOL geuttae_rect(id target, NSString *name, CGRect *outRect) {
    if (outRect == NULL) {
        return NO;
    }
    *outRect = CGRectNull;
    if (target == nil || name.length == 0) {
        return NO;
    }
    SEL selector = NSSelectorFromString(name);
    if (selector == NULL || ![target respondsToSelector:selector]) {
        return NO;
    }
    NSMethodSignature *signature = [target methodSignatureForSelector:selector];
    if (signature == nil || signature.numberOfArguments < 2) {
        return NO;
    }
    const char *returnType = signature.methodReturnType;
    if (returnType == NULL || strcmp(returnType, @encode(CGRect)) != 0) {
        return NO;
    }
    if (signature.methodReturnLength != sizeof(CGRect)) {
        return NO;
    }
    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
    if (invocation == nil) {
        return NO;
    }
    invocation.target = target;
    invocation.selector = selector;
    [invocation invoke];
    CGRect rect = CGRectZero;
    [invocation getReturnValue:&rect];
    if (CGRectIsNull(rect) || CGRectIsInfinite(rect) || CGRectIsEmpty(rect)) {
        return NO;
    }
    if (rect.size.width < 2.0 || rect.size.height < 2.0) {
        return NO;
    }
    *outRect = rect;
    return YES;
}

static BOOL geuttae_set_frame(id window, CGRect frame) {
    if (window == nil || CGRectIsNull(frame) || CGRectIsEmpty(frame)) {
        return NO;
    }
    SEL selector = NSSelectorFromString(@"setFrame:display:");
    if (selector == NULL || ![window respondsToSelector:selector]) {
        return NO;
    }
    NSMethodSignature *signature = [window methodSignatureForSelector:selector];
    if (signature == nil || signature.numberOfArguments < 4) {
        return NO;
    }
    const char *argumentType = [signature getArgumentTypeAtIndex:2];
    if (argumentType == NULL || strcmp(argumentType, @encode(CGRect)) != 0) {
        return NO;
    }
    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
    if (invocation == nil) {
        return NO;
    }
    invocation.target = window;
    invocation.selector = selector;
    [invocation setArgument:&frame atIndex:2];
    BOOL display = YES;
    [invocation setArgument:&display atIndex:3];
    [invocation invoke];
    return YES;
}

static BOOL geuttae_set_size(id window, NSString *name, CGSize size) {
    if (window == nil || size.width < 2.0 || size.height < 2.0) {
        return NO;
    }
    SEL selector = NSSelectorFromString(name);
    if (selector == NULL || ![window respondsToSelector:selector]) {
        return NO;
    }
    NSMethodSignature *signature = [window methodSignatureForSelector:selector];
    if (signature == nil || signature.numberOfArguments < 3) {
        return NO;
    }
    const char *argumentType = [signature getArgumentTypeAtIndex:2];
    if (argumentType == NULL || strcmp(argumentType, @encode(CGSize)) != 0) {
        return NO;
    }
    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
    if (invocation == nil) {
        return NO;
    }
    invocation.target = window;
    invocation.selector = selector;
    [invocation setArgument:&size atIndex:2];
    [invocation invoke];
    return YES;
}

static BOOL geuttae_set_bool(id target, NSString *name, BOOL value) {
    if (target == nil) {
        return NO;
    }
    SEL selector = NSSelectorFromString(name);
    if (selector == NULL || ![target respondsToSelector:selector]) {
        return NO;
    }
    NSMethodSignature *signature = [target methodSignatureForSelector:selector];
    if (signature == nil || signature.numberOfArguments < 3) {
        return NO;
    }
    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
    if (invocation == nil) {
        return NO;
    }
    invocation.target = target;
    invocation.selector = selector;
    [invocation setArgument:&value atIndex:2];
    [invocation invoke];
    return YES;
}

static BOOL geuttae_set_string(id target, NSString *name, NSString *value) {
    if (target == nil || value == nil) {
        return NO;
    }
    SEL selector = NSSelectorFromString(name);
    if (selector == NULL || ![target respondsToSelector:selector]) {
        return NO;
    }
    NSMethodSignature *signature = [target methodSignatureForSelector:selector];
    if (signature == nil || signature.numberOfArguments < 3) {
        return NO;
    }
    const char *argumentType = [signature getArgumentTypeAtIndex:2];
    if (argumentType == NULL || argumentType[0] != '@') {
        return NO;
    }
    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
    if (invocation == nil) {
        return NO;
    }
    invocation.target = target;
    invocation.selector = selector;
    [invocation setArgument:&value atIndex:2];
    [invocation invoke];
    return YES;
}

static void geuttae_forget_saved_frame(void) {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    if (defaults == nil) {
        return;
    }
    for (id key in defaults.dictionaryRepresentation.allKeys) {
        if ([key isKindOfClass:[NSString class]] && [key hasPrefix:@"NSWindow Frame"]) {
            [defaults removeObjectForKey:key];
        }
    }
}

__attribute__((constructor))
static void geuttae_prepare_mac_window(void) {
    if (![NSProcessInfo.processInfo isiOSAppOnMac]) {
        return;
    }
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    [defaults setBool:YES forKey:@"ApplePersistenceIgnoreState"];
    // 1.0은 맥이 아이폰 앱 창을 줄여 그리지 않게 합니다. 화면 배율 값이 없으면 창이 작게 열립니다.
    [defaults setDouble:1.0 forKey:@"UINSLastUsedWindowScaleFactor"];
    geuttae_forget_saved_frame();
}

static id geuttae_primary_screen(void) {
    if (!geuttae_appkit_ready()) {
        return nil;
    }
    Class screenClass = NSClassFromString(@"NSScreen");
    id screens = geuttae_object((id)screenClass, @"screens");
    if (![screens isKindOfClass:[NSArray class]] || [screens count] == 0) {
        return nil;
    }
    return [screens firstObject];
}

CGRect geuttae_visible_system_frame(void) {
    id screen = geuttae_primary_screen();
    CGRect full = CGRectNull;
    CGRect visible = CGRectNull;
    if (screen == nil || !geuttae_rect(screen, @"frame", &full) || !geuttae_rect(screen, @"visibleFrame", &visible)) {
        return CGRectNull;
    }
    CGFloat top = full.origin.y + full.size.height;
    CGFloat systemY = top - (visible.origin.y + visible.size.height);
    return CGRectMake(visible.origin.x - full.origin.x, systemY, visible.size.width, visible.size.height);
}

void geuttae_request_system_frame(id scene, double x, double y, double width, double height) {
    if (scene == nil || width < 2.0 || height < 2.0) {
        return;
    }
    Class prefsClass = NSClassFromString(@"UIWindowSceneGeometryPreferencesMac");
    if (prefsClass == Nil) {
        return;
    }
    CGRect systemFrame = CGRectMake(x, y, width, height);
    SEL initSelector = NSSelectorFromString(@"initWithSystemFrame:");
    id allocated = [prefsClass alloc];
    if (allocated == nil || ![allocated respondsToSelector:initSelector]) {
        return;
    }
    NSMethodSignature *signature = [allocated methodSignatureForSelector:initSelector];
    NSInvocation *invocation = signature == nil ? nil : [NSInvocation invocationWithMethodSignature:signature];
    if (invocation == nil || signature.numberOfArguments < 3) {
        return;
    }
    invocation.target = allocated;
    invocation.selector = initSelector;
    [invocation setArgument:&systemFrame atIndex:2];
    [invocation invoke];
    __unsafe_unretained id preferences = nil;
    [invocation getReturnValue:&preferences];
    if (preferences == nil) {
        return;
    }
    SEL request = NSSelectorFromString(@"requestGeometryUpdateWithPreferences:errorHandler:");
    if (![scene respondsToSelector:request]) {
        return;
    }
    NSMethodSignature *requestSignature = [scene methodSignatureForSelector:request];
    NSInvocation *requestInvocation = requestSignature == nil ? nil : [NSInvocation invocationWithMethodSignature:requestSignature];
    if (requestInvocation == nil || requestSignature.numberOfArguments < 4) {
        return;
    }
    requestInvocation.target = scene;
    requestInvocation.selector = request;
    [requestInvocation setArgument:&preferences atIndex:2];
    id handler = nil;
    [requestInvocation setArgument:&handler atIndex:3];
    [requestInvocation invoke];
}

void geuttae_apply_visible_frame(void) {
    id screen = geuttae_primary_screen();
    CGRect visible = CGRectNull;
    if (screen == nil || !geuttae_rect(screen, @"visibleFrame", &visible)) {
        return;
    }
    Class appClass = NSClassFromString(@"NSApplication");
    id app = geuttae_object((id)appClass, @"sharedApplication");
    if (app == nil) {
        return;
    }
    geuttae_forget_saved_frame();
    id windows = geuttae_object(app, @"windows");
    if (![windows isKindOfClass:[NSArray class]]) {
        windows = @[];
    }
    id keyWindow = geuttae_object(app, @"keyWindow");
    if (keyWindow != nil && [windows indexOfObjectIdenticalTo:keyWindow] == NSNotFound) {
        windows = [@[keyWindow] arrayByAddingObjectsFromArray:windows];
    }
    CGSize size = visible.size;
    CGSize cap = CGSizeMake(MAX(size.width, 8000), MAX(size.height, 8000));
    for (id window in windows) {
        if (window == nil) {
            continue;
        }
        geuttae_set_bool(window, @"setRestorable:", NO);
        geuttae_set_string(window, @"setFrameAutosaveName:", @"");
        geuttae_set_size(window, @"setMaxSize:", cap);
        geuttae_set_size(window, @"setContentMaxSize:", cap);
        geuttae_set_size(window, @"setMinSize:", size);
        geuttae_set_size(window, @"setContentMinSize:", size);
        geuttae_set_frame(window, visible);
    }
}
