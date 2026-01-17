[    0.000000] Linux version 6.18.5-cachyos-void-lto (void0x14@system) (gcc version 15.1.0, LTO) #1 SMP PREEMPT_DYNAMIC Sat Jan 17 15:42:00 TRT 2026
[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-linux-cachyos root=UUID=VOID-PARTITION rw quiet loglevel=3 systemd.show_status=auto
[    0.234001] x86/cpu: Vendor "AuthenticAMD" Family 23 Model 113 Stepping 0
[    0.234005] x86/cpu: Model name: AMD Ryzen 5 3600 6-Core Processor
[    1.402200] amdgpu 0000:08:00.0: amdgpu: Polaris11 (RX 460) detected. VRAM: 2048M
[   15.600210] systemd[1]: Reached target Graphical Interface.
[   42.000000] cachyos-sched: bore-scheduler active.
[   66.600000] OOM-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=0, oom_score_adj=0
[   88.888888] BUG: unable to handle page fault for address: ffff888000000000
[   99.999999] Kernel panic - not syncing: FATAL EXCEPTION IN INTERRUPT (IDENTITY_CRASH)
[   99.999999] CPU: 4 PID: 1337 Comm: void_process Tainted: P           OE      6.14.2-cachyos-void #1
[   99.999999] Hardware name: Custom_PC / B450_Motherboard, BIOS 4.20
[   99.999999] Call Trace:
[   99.999999]  <TASK>
[   99.999999]  dump_stack_lvl+0x45/0x5e
[   99.999999]  panic+0x11b/0x2f0
[   99.999999]  ? do_user_failure+0x50/0x90 [kernel_panic]
[   99.999999]  ? force_reboot+0x12/0x40 [root_shell]
[   99.999999]  __handle_emotional_corruption+0x8a/0x120 [black_box]
[   99.999999]  ? asm_exc_page_fault+0x22/0x30
[   99.999999]  </TASK>
[   99.999999] ---[ end Kernel panic - not syncing: FATAL EXCEPTION IN INTERRUPT ]---
