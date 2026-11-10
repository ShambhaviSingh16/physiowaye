-- Optional: restores only this migration's wording, without undoing later owner edits.
begin;
update public.products p
set product_name=b.old_title,description=b.old_description,admin_revision=p.admin_revision+1
from public.catalog_copy_backup_20261111 b
where p.id=b.product_id and p.sku=b.sku
  and p.product_name=b.new_title and p.description=b.new_description;
commit;
