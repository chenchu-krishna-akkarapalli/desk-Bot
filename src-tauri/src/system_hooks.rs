use tauri::command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct SystemHooks {
    last_activity: Arc<AtomicU64>,
    idle_threshold: Arc<Mutex<u64>>,
}

impl SystemHooks {
    pub fn new() -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        SystemHooks {
            last_activity: Arc::new(AtomicU64::new(now)),
            idle_threshold: Arc::new(Mutex::new(180)), // 3 minutes default
        }
    }

    pub fn get_idle_time_secs(&self) -> u64 {
        let last_activity = self.last_activity.load(Ordering::Relaxed);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        now.saturating_sub(last_activity) + os_impl::get_idle_time_secs()
    }

    pub fn update_activity(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        self.last_activity.store(now, Ordering::Relaxed);
    }

    pub fn is_idle(&self, threshold_secs: u64) -> bool {
        self.get_idle_time_secs() > threshold_secs
    }

    pub fn reset(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        self.last_activity.store(now, Ordering::Relaxed);
    }
}

#[command]
pub fn get_idle_time() -> u64 {
    os_impl::get_idle_time_secs()
}

#[cfg(target_os = "macos")]
mod os_impl {
    use std::os::raw::{c_double, c_void};

    #[repr(C)]
    struct __CGEventSource(c_void);
    type CGEventSourceRef = *mut __CGEventSource;
    type CGEventSourceStateID = i32;

    const K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE: CGEventSourceStateID = 1;
    const K_CG_ANY_INPUT_EVENT_TYPE: u32 = 0xFFFFFFFF;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceCreate(state_id: CGEventSourceStateID) -> CGEventSourceRef;
        fn CGEventSourceSecondsSinceLastEventType(
            source: CGEventSourceRef,
            event_type: u32,
        ) -> c_double;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(cf: *mut c_void);
    }

    pub fn get_idle_time_secs() -> u64 {
        unsafe {
            let source = CGEventSourceCreate(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE);
            if source.is_null() {
                return 0;
            }
            let seconds = CGEventSourceSecondsSinceLastEventType(source, K_CG_ANY_INPUT_EVENT_TYPE);
            CFRelease(source as *mut c_void);
            seconds.max(0.0) as u64
        }
    }
}

#[cfg(target_os = "windows")]
mod os_impl {
    use windows::Win32::System::SystemInformation::GetTickCount64;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    pub fn get_idle_time_secs() -> u64 {
        unsafe {
            let mut lii = LASTINPUTINFO {
                cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };
            if GetLastInputInfo(&mut lii).as_bool() {
                let tick_count = GetTickCount64();
                let idle_ms = tick_count.saturating_sub(lii.dwTime as u64);
                idle_ms / 1000
            } else {
                0
            }
        }
    }
}

#[cfg(target_os = "linux")]
mod os_impl {
    use std::ptr;

    pub fn get_idle_time_secs() -> u64 {
        unsafe {
            let display = x11::xlib::XOpenDisplay(ptr::null());
            if display.is_null() {
                return 0;
            }
            let root = x11::xlib::XDefaultRootWindow(display);
            let info = x11::xss::XScreenSaverAllocInfo();
            if info.is_null() {
                x11::xlib::XCloseDisplay(display);
                return 0;
            }
            let result = x11::xss::XScreenSaverQueryInfo(display, root, info);
            let idle = if result != 0 { (*info).idle / 1000 } else { 0 };
            x11::xlib::XFree(info as *mut libc::c_void);
            x11::xlib::XCloseDisplay(display);
            idle
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod os_impl {
    pub fn get_idle_time_secs() -> u64 {
        0
    }
}

#[command]
pub fn check_system_idle() -> Result<u64, String> {
    let idle = os_impl::get_idle_time_secs();
    Ok(idle)
}
