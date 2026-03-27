const std = @import("std");

pub const EventType = enum(u8) {
    session_start = 1,
    canonical = 2,
    scene = 3,
    fork = 4,
    hidden = 5,
    mode = 6,
};

pub fn fromString(value: []const u8) !EventType {
    if (std.mem.eql(u8, value, "session_start")) return .session_start;
    if (std.mem.eql(u8, value, "canonical")) return .canonical;
    if (std.mem.eql(u8, value, "scene")) return .scene;
    if (std.mem.eql(u8, value, "fork")) return .fork;
    if (std.mem.eql(u8, value, "hidden")) return .hidden;
    if (std.mem.eql(u8, value, "mode")) return .mode;
    return error.InvalidEventType;
}

pub fn toString(event_type: EventType) []const u8 {
    return switch (event_type) {
        .session_start => "session_start",
        .canonical => "canonical",
        .scene => "scene",
        .fork => "fork",
        .hidden => "hidden",
        .mode => "mode",
    };
}

test "event type roundtrip" {
    const testing = std.testing;
    try testing.expectEqual(EventType.scene, try fromString("scene"));
    try testing.expectEqualStrings("fork", toString(.fork));
}
