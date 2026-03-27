const std = @import("std");
const protocol = @import("protocol");
const store_mod = @import("store");
const event = @import("event");
const io = std.Options.debug_io;

pub fn handleConnection(allocator: std.mem.Allocator, stream: std.Io.net.Stream, store: *store_mod.Store) !void {
    var reader_buffer: [2048]u8 = undefined;
    var reader = stream.reader(io, &reader_buffer);

    const request_line = try trimLine(try reader.interface.takeDelimiterExclusive('\n'));
    var request_parts = std.mem.splitScalar(u8, request_line, ' ');
    const method = request_parts.next() orelse return error.InvalidHttpRequest;
    const path = request_parts.next() orelse return error.InvalidHttpRequest;

    var content_length: usize = 0;
    while (true) {
        const line = try trimLine(try reader.interface.takeDelimiterExclusive('\n'));
        if (line.len == 0) break;
        if (line.len >= "Content-Length:".len and std.ascii.eqlIgnoreCase(line[0.."Content-Length:".len], "Content-Length:")) {
            content_length = try std.fmt.parseInt(usize, std.mem.trim(u8, line["Content-Length:".len..], " "), 10);
        }
    }

    const body = if (content_length == 0) &[_]u8{} else try reader.interface.readAlloc(allocator, content_length);
    defer if (content_length != 0) allocator.free(body);

    const route = try parseRoute(method, path);
    switch (route) {
        .options => try writeResponse(stream, "204 No Content", "text/plain", ""),
        .health => try writeResponse(stream, "200 OK", "application/json", "{\"status\":\"ok\",\"service\":\"kernel-panic-backend\"}"),
        .start_session => {
            const payload = if (body.len == 0) "{}" else body;
            const session_id = try store.startSession(allocator, payload);
            const response = try std.fmt.allocPrint(allocator, "{{\"session_id\":{d},\"status\":\"started\"}}", .{session_id});
            defer allocator.free(response);
            try writeResponse(stream, "201 Created", "application/json", response);
        },
        .append_event => |info| {
            try store.appendEvent(allocator, info.session_id, info.event_type, @intCast(@divFloor(std.Io.Timestamp.now(std.Options.debug_io, .real).nanoseconds, std.time.ns_per_ms)), body);
            try writeResponse(stream, "202 Accepted", "application/json", "{\"status\":\"appended\"}");
        },
        .replay_session => |session_id| {
            const replay_body = try store.allocReplayJson(allocator, session_id);
            defer allocator.free(replay_body);
            try writeResponse(stream, "200 OK", "application/json", replay_body);
        },
    }
}

const Route = union(enum) {
    options,
    health,
    start_session,
    append_event: struct { session_id: u32, event_type: event.EventType },
    replay_session: u32,
};

fn parseRoute(method: []const u8, path: []const u8) !Route {
    if (std.mem.eql(u8, method, "OPTIONS")) {
        return .options;
    }
    if (std.mem.eql(u8, method, "GET") and std.mem.eql(u8, path, "/health")) {
        return .health;
    }
    if (std.mem.eql(u8, method, "POST") and std.mem.eql(u8, path, "/api/session/start")) {
        return .start_session;
    }
    if (std.mem.eql(u8, method, "GET") and std.mem.startsWith(u8, path, "/api/session/")) {
        const tail = path["/api/session/".len..];
        const session_id = try std.fmt.parseInt(u32, tail, 10);
        return .{ .replay_session = session_id };
    }
    if (std.mem.eql(u8, method, "POST") and std.mem.startsWith(u8, path, "/api/session/")) {
        const tail = path["/api/session/".len..];
        const event_marker = std.mem.indexOf(u8, tail, "/event/") orelse return error.InvalidHttpRoute;
        const session_id = try std.fmt.parseInt(u32, tail[0..event_marker], 10);
        const event_name = tail[event_marker + "/event/".len ..];
        const event_type = try event.fromString(event_name);
        return .{ .append_event = .{ .session_id = session_id, .event_type = event_type } };
    }
    return error.InvalidHttpRoute;
}

fn trimLine(line: []u8) ![]u8 {
    if (line.len > 0 and line[line.len - 1] == '\r') {
        return line[0 .. line.len - 1];
    }
    return line;
}

fn writeResponse(stream: std.Io.net.Stream, status: []const u8, content_type: []const u8, body: []const u8) !void {
    const header = try std.fmt.allocPrint(
        std.heap.page_allocator,
        "HTTP/1.1 {s}\r\nContent-Type: {s}\r\nContent-Length: {d}\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\n\r\n",
        .{ status, content_type, body.len },
    );
    defer std.heap.page_allocator.free(header);
    var writer_buffer: [2048]u8 = undefined;
    var writer = stream.writer(io, &writer_buffer);
    try writer.interface.writeAll(header);
    if (body.len > 0) {
        try writer.interface.writeAll(body);
    }
    try writer.interface.flush();
}

test "parse append event route" {
    const route = try parseRoute("POST", "/api/session/42/event/scene");
    switch (route) {
        .append_event => |info| {
            try std.testing.expectEqual(@as(u32, 42), info.session_id);
            try std.testing.expectEqual(event.EventType.scene, info.event_type);
        },
        else => try std.testing.expect(false),
    }
}
