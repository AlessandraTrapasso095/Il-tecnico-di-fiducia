-- Categories taxonomy for dropdowns / landing sections.
-- This is not "fake user content": it's a real, static list of professions.

insert into public.categories (name, slug, image_url) values
  (
    'Ingegneri',
    'ingegneri',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCQq5eVwBnqFjCnN86gkFsD--RbpO8N_s6_TA8GUajyTqu6oCUaTiaYakGsIYitF-97_Uk2reoVX4o7Ng4T_MF88_bowkzm2cg9PS1J9iUrkKtX5eac3wL1W3xOqfUOopiVVwkf6Qys-QdMbxn0ya-kAXqG0hC5lqML96RMdvJwDkTcYRgEonQLxHro7pPizfQQbBcjo7XdkzM9baEGOBg3XOQ-oonbtWb9NJgHQjYmrdTpoSzSG9L5dPuzaczVjqWXc_OKVZUFfqfx'
  ),
  (
    'Architetti',
    'architetti',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCemy7B9P1kpymYEeupmx-XbZJbor21lsR3jFt0_2O7LDdqTipkZj9HclMYQXbIf4EfDK3ZjzjlWMhoBy4v3s58dSSf84zDT6k_CteC29vdcmSihTjOgt0SlsdiRaomsvxuVx8wlcxpYK2UUrXSZSUL72A4XmJToxUa9BHiRK24fjI5IM3sgqVU6BvpsReK9Sdl0Px18LhmT3-SPjEzv4xRVPoHsHt2a0iPJKq7T6nMsDQXi51M67xvk0GzJZ-PfaI2k3wvOujvYL6N'
  ),
  (
    'Geometri',
    'geometri',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCZjyAQrIYj9PpsLD914K3jCPsLWpvMEPfmR1DQm3cPuyzEi_e5YHYGDw9aY-mrabNjatIFzRTSD_yd02P2R_Sz26ensYbVkMIMXGbSn1LW9hNWy5fFHoiaIcMKarFyw604xQnP9NPfmpDA12FOLJmHKGmqT4Vc-Mbcrd4hnMFfMVV9mdsTGxUmgDbO_sllDG9HUso9vcBGhUQmsVMIEtv9nhG8NvZhBdOg6COtR_a37Yq8fyDyheKVzUILyWvF8b9ZZDDrvCUNM4_B'
  ),
  (
    'Informatici',
    'informatici',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA0BRkP_kdLM5gmqNvA3ASa1eldNmGn217TsvbodTyYavS_zfg3ew2nMjLelsX4dZSAF5jDUOfttdhf6BtGMhVR13EoYshrJGSAmNeyRuboZaEEuEuFNyhnBoVMaRbWbanQr6mQG0HdfZxKmKeQS5FGprM89I3DvN2yAqZZATWRqUlsu9k8vkep6p36OVFp-Y3rlKRWwYoDdfHBl-PDnXt6PnXycSzDIh0ppOt87HJLYsykmPBS80ilw-liWpJ236AG6aNZNq0ozlWk'
  ),
  (
    'Avvocati',
    'avvocati',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCpGguOIk8O9WjodNTRAptgdt5rbPdYg3BtA0ZgQ4KIjLPjI6eRlQO2jMlgnvj2ROIC6lx7LObwLac8BKaqBhjlc6UIxwGiSoZrVRfK69BZvUXUyLgGoACuFwmA9XLwKyNuscNkLMuUpsyh2fMWh6sy1OS6PkgpIll-QCsLiH3txOC9iG9mnEgb7l2H6BkDhQePlBqa4xROLfcpv-YaGBDMc3J5_rB1VY2YzOshgFAd1_x2K_h_g16uDVss5Uu_RQlkdl9NGAvyF2Do'
  ),
  (
    'Elettricisti',
    'elettricisti',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCQpvXQFlipYZ48NEsT-LZTRmvyOBOHiT2ebEU7F4uwGA-83zTRC5t1RPGYtAMbxUFxkpdkiIvIBFs9WgwiMYxturHn2w2os0sVZPtG8ZlXLJv_zJHXeD3w9iA4H95VazOu-XaBenq4EaKtYqINoMtenPz2g0IEwx9wZ3Nj92ho-vFKnlbdtT_eqzd-rO-NAvGRINmeHwousj4xkHtHNbnJBQVtEw7y1RrfJJWSlNJHo8ay0JzD1qC1j0BZ6umhOGA6DDnRzqhj1_-f'
  )
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url;

