//! Hardware Intelligence Layer.
//!
//! Detects the current default audio output device and classifies it into a
//! coarse device class using name heuristics, then maps that class to a
//! recommended listening mode and tuning rationale. This is intentionally a
//! *suggestion* layer: it never changes audio on its own. The frontend decides
//! whether to apply the suggested policy, so user intent always wins (§5H).
//!
//! Vendor-exact calibration can layer on top later; the registry below is the
//! stable, updateable seed the rest of the engine can grow against (§12).

use rodio::cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

/// Coarse output-device classification. Serializes to its variant name
/// (e.g. `"GamingHeadset"`), which the frontend maps to labels/icons.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeviceClass {
    Unknown,
    ConsumerHeadphones,
    GamingHeadset,
    AudiophileHeadphones,
    BluetoothEarbuds,
    StudioMonitors,
    HomeSpeakers,
    Soundbar,
    ExternalDAC,
    AudioInterface,
}

/// A resolved profile for the active output device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceProfile {
    /// Raw device name reported by the OS (best-effort).
    pub name: String,
    pub class: DeviceClass,
    /// Human-friendly class label for the UI.
    pub class_label: String,
    /// Why this class was chosen / what tuning it wants.
    pub description: String,
    /// Id of the recommended entry in the frontend `LISTENING_MODES` registry.
    pub suggested_mode: String,
    /// Heuristic guess that the device is wireless (latency/codec caveats).
    pub is_wireless: bool,
    /// False when no device could be detected and safe defaults were used.
    pub detected: bool,
}

/// Best-effort name of the current default output device.
pub fn current_output_name() -> Option<String> {
    let host = rodio::cpal::default_host();
    host.default_output_device()
        .and_then(|device| device.name().ok())
        .filter(|name| !name.trim().is_empty())
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| haystack.contains(n))
}

/// Classify a device from its (already lowercased) name. Ordering matters:
/// more specific product families are checked before generic terms.
pub fn classify(name_lower: &str) -> DeviceClass {
    // External DACs / headphone amps.
    if contains_any(
        name_lower,
        &["dac", "dragonfly", "fiio", "schiit", "topping", "chord ", "qudelix"],
    ) {
        return DeviceClass::ExternalDAC;
    }

    // Pro audio interfaces.
    if contains_any(
        name_lower,
        &[
            "interface", "scarlett", "focusrite", "audient", "motu", "presonus",
            "ur22", "ur44", "babyface", "apollo", "clarett",
        ],
    ) {
        return DeviceClass::AudioInterface;
    }

    // Gaming headsets.
    if contains_any(
        name_lower,
        &[
            "gaming", "headset", "hyperx", "steelseries", "arctis", "razer",
            "kraken", "barracuda", "cloud ", "astro", "logitech g", "blackshark",
        ],
    ) {
        return DeviceClass::GamingHeadset;
    }

    // Audiophile / reference headphones (families and model prefixes).
    if contains_any(
        name_lower,
        &[
            "hifiman", "sundara", "arya", "lcd-", "audeze", "beyerdynamic",
            "dt 990", "dt 880", "dt 770", "hd 600", "hd 650", "hd 660", "hd 800",
            "planar", "focal ",
        ],
    ) {
        return DeviceClass::AudiophileHeadphones;
    }

    // Studio monitors.
    if contains_any(
        name_lower,
        &["monitor", "krk", "genelec", "rokit", "adam audio", "hs5", "hs7", "hs8", "eris"],
    ) {
        return DeviceClass::StudioMonitors;
    }

    // Soundbars.
    if contains_any(name_lower, &["soundbar", "sound bar"]) {
        return DeviceClass::Soundbar;
    }

    // Wireless earbuds.
    if contains_any(
        name_lower,
        &["airpods", "earbuds", "buds", "wf-", "galaxy buds", "jabra", "earphone"],
    ) {
        return DeviceClass::BluetoothEarbuds;
    }

    // Generic headphones.
    if contains_any(name_lower, &["headphone", "wh-", "ath-", "sennheiser", "sony ", "bose"]) {
        return DeviceClass::ConsumerHeadphones;
    }

    // Generic speakers (checked late so specific classes win first).
    if contains_any(name_lower, &["speaker", "realtek", "display audio", "monitor audio"]) {
        return DeviceClass::HomeSpeakers;
    }

    DeviceClass::Unknown
}

fn is_wireless(name_lower: &str) -> bool {
    contains_any(
        name_lower,
        &["bluetooth", "wireless", "airpods", "buds", "wf-", "wh-", "jabra"],
    )
}

/// Static registry: class → (label, rationale, suggested listening-mode id).
fn registry_entry(class: DeviceClass) -> (&'static str, &'static str, &'static str) {
    match class {
        DeviceClass::Unknown => (
            "Unknown Device",
            "Device not recognized — using safe, transparent defaults.",
            "music",
        ),
        DeviceClass::ConsumerHeadphones => (
            "Consumer Headphones",
            "Balanced enhancement with a lively image suits most headphones.",
            "music",
        ),
        DeviceClass::GamingHeadset => (
            "Gaming Headset",
            "Forward mids and controlled width sharpen positional cues.",
            "gaming",
        ),
        DeviceClass::AudiophileHeadphones => (
            "Audiophile Headphones",
            "High-resolution cans deserve a transparent, uncolored path.",
            "audiophile",
        ),
        DeviceClass::BluetoothEarbuds => (
            "Bluetooth Earbuds",
            "Small drivers benefit from headphone compensation and gentle bass.",
            "music",
        ),
        DeviceClass::StudioMonitors => (
            "Studio Monitors",
            "Flat, honest monitoring with headroom reserved for peaks.",
            "production",
        ),
        DeviceClass::HomeSpeakers => (
            "Home Speakers",
            "Room-friendly enhancement with a wider stereo image.",
            "music",
        ),
        DeviceClass::Soundbar => (
            "Soundbar",
            "Cinematic width and dialogue clarity for film and TV.",
            "cinema",
        ),
        DeviceClass::ExternalDAC => (
            "External DAC",
            "A dedicated DAC implies audiophile intent — keep it bit-perfect.",
            "reference",
        ),
        DeviceClass::AudioInterface => (
            "Audio Interface",
            "Pro interfaces want flat, uncolored monitoring.",
            "production",
        ),
    }
}

/// Resolve a full profile for the current default output device.
pub fn detect_profile() -> DeviceProfile {
    match current_output_name() {
        Some(name) => {
            let lower = name.to_lowercase();
            let class = classify(&lower);
            let (label, description, suggested_mode) = registry_entry(class);
            DeviceProfile {
                name,
                class,
                class_label: label.to_string(),
                description: description.to_string(),
                suggested_mode: suggested_mode.to_string(),
                is_wireless: is_wireless(&lower),
                detected: true,
            }
        }
        None => {
            let (label, description, suggested_mode) = registry_entry(DeviceClass::Unknown);
            DeviceProfile {
                name: "No output device".to_string(),
                class: DeviceClass::Unknown,
                class_label: label.to_string(),
                description: description.to_string(),
                suggested_mode: suggested_mode.to_string(),
                is_wireless: false,
                detected: false,
            }
        }
    }
}

#[tauri::command]
pub fn get_output_device() -> DeviceProfile {
    detect_profile()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_known_families() {
        assert_eq!(classify("steelseries arctis nova pro"), DeviceClass::GamingHeadset);
        assert_eq!(classify("fiio k7 dac"), DeviceClass::ExternalDAC);
        assert_eq!(classify("focusrite scarlett 2i2 usb"), DeviceClass::AudioInterface);
        assert_eq!(classify("beyerdynamic dt 990 pro"), DeviceClass::AudiophileHeadphones);
        assert_eq!(classify("krk rokit 5 monitor"), DeviceClass::StudioMonitors);
        assert_eq!(classify("airpods pro"), DeviceClass::BluetoothEarbuds);
        assert_eq!(classify("realtek high definition audio speakers"), DeviceClass::HomeSpeakers);
        assert_eq!(classify("some mystery box"), DeviceClass::Unknown);
    }

    #[test]
    fn specific_classes_win_over_generic() {
        // "headset" must classify as gaming even though "head" is generic.
        assert_eq!(classify("hyperx cloud ii headset"), DeviceClass::GamingHeadset);
        // A DAC named with "audio" should not fall through to speakers.
        assert_eq!(classify("topping e30 dac"), DeviceClass::ExternalDAC);
    }

    #[test]
    fn wireless_detection() {
        assert!(is_wireless("sony wh-1000xm5 bluetooth"));
        assert!(is_wireless("airpods pro"));
        assert!(!is_wireless("beyerdynamic dt 990 pro"));
    }

    #[test]
    fn unknown_falls_back_to_safe_mode() {
        let (_, _, mode) = registry_entry(DeviceClass::Unknown);
        assert_eq!(mode, "music");
    }
}
