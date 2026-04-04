-- Ganti UUID user sesuai auth.users di Supabase
insert into public.outlets (id, name, brand_name, address, phone)
values ('11111111-1111-1111-1111-111111111111', 'Outlet Pusat', 'Angkringan Demo', 'Jl. Contoh No. 1', '081234567890')
on conflict do nothing;

insert into public.categories (id, outlet_id, name, sort_order)
values
('22222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Kopi', 1),
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Makanan', 2)
on conflict do nothing;

insert into public.menus (id, outlet_id, category_id, sku, name, price, cost_price, is_available)
values
('33333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', 'KOPI-001', 'Kopi Tubruk', 7000, 3000, true),
('33333333-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'MKN-001', 'Nasi Kucing', 5000, 2500, true)
on conflict do nothing;

insert into public.printer_settings (outlet_id, printer_name, printer_type, connection_value, paper_width, auto_print_receipt, is_active)
values ('11111111-1111-1111-1111-111111111111', 'Thermal LAN', 'network', '192.168.1.77', '58mm', true, true)
on conflict do nothing;

insert into public.branding_settings (outlet_id, brand_name, primary_color, secondary_color, receipt_footer, whatsapp_number)
values ('11111111-1111-1111-1111-111111111111', 'Angkringan Demo', '#F59E0B', '#0F172A', 'Terima kasih, semoga harimu hangat.', '6281234567890')
on conflict (outlet_id) do nothing;
