const std = @import("std");
const event = @import("event");

pub const WireHeader = struct {
    pub const byte_len: usize = 17;

    event_type: event.EventType,
    timestamp_ms: u64,
    session_id: u32,
    payload_size: u32,

    pub fn encode(self: WireHeader, out: *[byte_len]u8) void {
        out[0] = @intFromEnum(self.event_type);
        std.mem.writeInt(u64, out[1..9], self.timestamp_ms, .little);
        std.mem.writeInt(u32, out[9..13], self.session_id, .little);
        std.mem.writeInt(u32, out[13..17], self.payload_size, .little);
    }

    pub fn decode(bytes: []const u8) !WireHeader {
        if (bytes.len != byte_len) return error.InvalidHeaderLength;
        const event_type: event.EventType = switch (bytes[0]) {
            1 => .session_start,
            2 => .canonical,
            3 => .scene,
            4 => .fork,
            5 => .hidden,
            6 => .mode,
            else => return error.InvalidEventType,
        };
        return .{
            .event_type = event_type,
            .timestamp_ms = std.mem.readInt(u64, bytes[1..9], .little),
            .session_id = std.mem.readInt(u32, bytes[9..13], .little),
            .payload_size = std.mem.readInt(u32, bytes[13..17], .little),
        };
    }
};

test "wire header roundtrip" {
    const testing = std.testing;
    const header: WireHeader = .{
        .event_type = .scene,
        .timestamp_ms = 12345,
        .session_id = 42,
        .payload_size = 99,
    };
    var bytes: [WireHeader.byte_len]u8 = undefined;
    header.encode(&bytes);
    const decoded = try WireHeader.decode(&bytes);
    try testing.expectEqual(header.event_type, decoded.event_type);
    try testing.expectEqual(header.timestamp_ms, decoded.timestamp_ms);
    try testing.expectEqual(header.session_id, decoded.session_id);
    try testing.expectEqual(header.payload_size, decoded.payload_size);
}
