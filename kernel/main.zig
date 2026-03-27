const std = @import("std");
const handler = @import("handler");
const store_mod = @import("store");
pub fn main(init: std.process.Init) !void {
    const port = try loadPort(init);
    var store = try store_mod.Store.init(std.Io.Dir.cwd(), "data/sessions");

    var address = try std.Io.net.IpAddress.parseLiteral("0.0.0.0:8787");
    address.setPort(port);
    var server = try address.listen(init.io, .{});
    defer server.deinit(init.io);

    std.debug.print("[backend] listening on 0.0.0.0:{d}\n", .{port});

    while (true) {
        const connection = try server.accept(init.io);
        const thread = try std.Thread.spawn(.{}, handleAcceptedConnection, .{ init.io, &store, connection });
        thread.detach();
    }
}

fn loadPort(init: std.process.Init) !u16 {
    if (init.environ_map.get("KERNEL_PORT")) |value| {
        return try std.fmt.parseInt(u16, std.mem.trim(u8, value, " \t\r\n"), 10);
    }
    return 8787;
}

fn handleAcceptedConnection(io: std.Io, store: *store_mod.Store, connection: std.Io.net.Stream) void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    defer connection.close(io);

    handler.handleConnection(arena.allocator(), connection, store) catch |err| {
        std.debug.print("[backend] connection error: {s}\n", .{@errorName(err)});
    };
}
