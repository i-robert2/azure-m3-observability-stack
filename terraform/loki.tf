# Storage account backing Loki's chunk store, so logs survive pod restarts.
resource "random_string" "loki" {
  length  = 6
  special = false
  upper   = false
  numeric = true
}

resource "azurerm_storage_account" "loki" {
  name                            = substr("stloki${random_string.loki.result}${local.base_alphanum}", 0, 24)
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  tags                            = local.tags

  lifecycle { ignore_changes = [tags["created_date"]] }
}

resource "azurerm_storage_container" "loki_chunks" {
  name                  = "loki-chunks"
  storage_account_id    = azurerm_storage_account.loki.id
  container_access_type = "private"
}

output "loki_storage_account" {
  value = azurerm_storage_account.loki.name
}

output "loki_storage_key" {
  value     = azurerm_storage_account.loki.primary_access_key
  sensitive = true
}
