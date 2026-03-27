const std = @import("std");
const event = @import("event");
const protocol = @import("protocol");
const io = std.Options.debug_io;

pub const Store = struct {
    root: std.Io.Dir,
    base_path: []const u8,
    mutex: std.Io.Mutex = .init,
    next_session_id: u32,

    pub fn init(root: std.Io.Dir, base_path: []const u8) !Store {
        try root.createDirPath(io, base_path);
        const seed: u32 = @truncate(@as(u64, @intCast(@divFloor(std.Io.Timestamp.now(io, .real).nanoseconds, std.time.ns_per_ms))));
        return .{
            .root = root,
            .base_path = base_path,
            .next_session_id = if (seed == 0) 1 else seed,
        };
    }

    pub fn startSession(self: *Store, allocator: std.mem.Allocator, meta_payload: []const u8) !u32 {
        try self.mutex.lock(io);
        defer self.mutex.unlock(io);

        const session_id = try self.allocateSessionId(allocator);
        try self.appendEventLocked(allocator, session_id, .session_start, @intCast(@divFloor(std.Io.Timestamp.now(io, .real).nanoseconds, std.time.ns_per_ms)), meta_payload);
        return session_id;
    }

    pub fn appendEvent(self: *Store, allocator: std.mem.Allocator, session_id: u32, event_type: event.EventType, timestamp_ms: u64, payload: []const u8) !void {
        try self.mutex.lock(io);
        defer self.mutex.unlock(io);
        try self.appendEventLocked(allocator, session_id, event_type, timestamp_ms, payload);
    }

    pub fn allocReplayJson(self: *Store, allocator: std.mem.Allocator, session_id: u32) ![]u8 {
        try self.mutex.lock(io);
        defer self.mutex.unlock(io);

        const path = try self.sessionPath(allocator, session_id);
        defer allocator.free(path);

        var file = try self.root.openFile(io, path, .{ .mode = .read_only });
        defer file.close(io);

        const stat = try file.stat(io);
        const bytes = try allocator.alloc(u8, @intCast(stat.size));
        defer allocator.free(bytes);
        _ = try file.readPositionalAll(io, bytes, 0);

        var output: std.ArrayList(u8) = .empty;
        errdefer output.deinit(allocator);
        try output.print(allocator, "{{\"session_id\":{d},\"events\":[", .{session_id});
        var first = true;
        var offset: usize = 0;
        while (offset + protocol.WireHeader.byte_len <= bytes.len) {
            const header = try protocol.WireHeader.decode(bytes[offset .. offset + protocol.WireHeader.byte_len]);
            const payload_start = offset + protocol.WireHeader.byte_len;
            const payload_end = payload_start + header.payload_size;
            if (payload_end > bytes.len) return error.InvalidPayloadLength;
            const payload = bytes[payload_start..payload_end];
            if (!first) try output.appendSlice(allocator, ",");
            first = false;
            try output.print(
                allocator,
                "{{\"type\":\"{s}\",\"timestamp_ms\":{d},\"session_id\":{d},\"payload\":",
                .{ event.toString(header.event_type), header.timestamp_ms, header.session_id },
            );
            if (payload.len == 0) {
                try output.appendSlice(allocator, "null");
            } else {
                try output.appendSlice(allocator, payload);
            }
            try output.appendSlice(allocator, "}");
            offset = payload_end;
        }
        try output.appendSlice(allocator, "]}");
        return try output.toOwnedSlice(allocator);
    }

    fn allocateSessionId(self: *Store, allocator: std.mem.Allocator) !u32 {
        var candidate = self.next_session_id;
        while (true) : (candidate += 1) {
            const path = try self.sessionPath(allocator, candidate);
            defer allocator.free(path);
            self.root.access(io, path, .{}) catch |err| switch (err) {
                error.FileNotFound => {
                    self.next_session_id = candidate + 1;
                    return candidate;
                },
                else => return err,
            };
        }
    }

    fn appendEventLocked(self: *Store, allocator: std.mem.Allocator, session_id: u32, event_type: event.EventType, timestamp_ms: u64, payload: []const u8) !void {
        const path = try self.sessionPath(allocator, session_id);
        defer allocator.free(path);

        var file = try self.root.createFile(io, path, .{ .read = true, .truncate = false });
        defer file.close(io);

        var header_bytes: [protocol.WireHeader.byte_len]u8 = undefined;
        const header: protocol.WireHeader = .{
            .event_type = event_type,
            .timestamp_ms = timestamp_ms,
            .session_id = session_id,
            .payload_size = @intCast(payload.len),
        };
        header.encode(&header_bytes);
        const end_offset = (try file.stat(io)).size;
        var writer_buffer: [1024]u8 = undefined;
        var writer = file.writer(io, &writer_buffer);
        writer.pos = end_offset;
        try writer.interface.writeAll(&header_bytes);
        try writer.interface.writeAll(payload);
        try writer.interface.flush();
        try file.sync(io);
    }

    fn sessionPath(self: *Store, allocator: std.mem.Allocator, session_id: u32) ![]u8 {
        return std.fmt.allocPrint(allocator, "{s}/{d}.kplog", .{ self.base_path, session_id });
    }
};

test "store appends and replays session events" {
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();

    var store = try Store.init(tmp.dir, "sessions");
    const allocator = std.testing.allocator;
    const session_id = try store.startSession(allocator, "{\"origin\":\"test\"}");
    try store.appendEvent(allocator, session_id, .scene, 1234, "{\"location\":\"home\"}");

    var output: std.ArrayList(u8) = .empty;
    defer output.deinit(allocator);
    const json = try store.allocReplayJson(allocator, session_id);
    defer allocator.free(json);
    try output.appendSlice(allocator, json);

    try std.testing.expect(std.mem.indexOf(u8, output.items, "\"session_id\"") != null);
    try std.testing.expect(std.mem.indexOf(u8, output.items, "\"location\":\"home\"") != null);
}
