# Integración en Razor Pages — Guía Completa de Producción

> **Fecha de última actualización:** 2026-03-13
> **Componente compilado:** `dist/shipping-doc-viewer.js` (61.54 kB / 17.84 kB gzip)
> **Dependencias backend:** Syncfusion.Pdf.Net.Core (merge PDFs), System.IO.Compression (ZIP mixto)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER                                                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  <shipping-doc-viewer>  (Web Component, Shadow DOM)      │   │
│  │                                                          │   │
│  │  Clic descarga fila ──► emitDownloadEvent([1 doc])       │   │
│  │  Clic "Download All" ─► emitDownloadEvent([N docs])      │   │
│  │  Clic "Download (3)" ─► emitDownloadEvent([3 docs])      │   │
│  │                                                          │   │
│  │  SIEMPRE emite CustomEvent 'download-request'            │   │
│  │  con payload: { files[], allSameType, fileType }         │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │                                    │
│                   addEventListener                              │
│                            │                                    │
│  ┌─────────────────────────▼────────────────────────────────┐   │
│  │  <script> en DocumentViewer.cshtml                       │   │
│  │                                                          │   │
│  │  fetch POST /api/documents/download                      │   │
│  │  Header: X-Access-Token = token del URL                  │   │
│  │  Body: { files[], allSameType, fileType }                │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│  ASP.NET Razor Pages Backend                                    │
│                                                                 │
│  DocumentsController.Download(request, token)                   │
│    1. Valida token en BD (scope, expiración, revocación)        │
│    2. Valida file IDs contra documentos del scope del token     │
│    3. Descarga archivos de Azure Blob                           │
│    4. Decide respuesta:                                         │
│       ├─ 1 archivo     → proxy directo (content-type real)     │
│       ├─ N PDFs iguales → merge con Syncfusion → 1 PDF         │
│       └─ Tipos mixtos  → ZipArchive → .zip                     │
│    5. Retorna FileResult al browser                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estructura de archivos a crear

```
YourProject/
├── Pages/
│   └── External/
│       └── DocumentViewer.cshtml            ← Página sin layout
│       └── DocumentViewer.cshtml.cs         ← Handler OnGetAsync
├── Controllers/
│   └── DocumentsController.cs              ← API descarga (single/merge/zip)
├── Services/
│   └── DocumentTokenService.cs             ← Servicio de tokens
│   └── ShipmentDocumentService.cs          ← Consulta documentos + SAS URLs
├── Models/
│   └── DocumentViewerModels.cs             ← DTOs
├── wwwroot/
│   └── js/
│       └── shipping-doc-viewer.js          ← Componente compilado (copiar de dist/)
└── Data/
    └── Migrations/
        └── AddDocumentTokensTable.sql      ← Tabla para tokens
```

---

## PASO 1: Crear tabla para tokens persistentes (SQL Server)

```sql
-- AddDocumentTokensTable.sql
CREATE TABLE [dbo].[DocumentAccessTokens] (
    [Id]              INT IDENTITY(1,1) PRIMARY KEY,
    [Token]           NVARCHAR(64)  NOT NULL,
    [MawbNumber]      NVARCHAR(50)  NOT NULL,
    [AccessScope]     NVARCHAR(20)  NOT NULL DEFAULT 'Full',  -- Full | Consignee | Shipper
    [ScopeEntityName] NVARCHAR(255) NULL,                     -- Nombre del consignee o shipper
    [ClientEmail]     NVARCHAR(255) NULL,
    [CreatedAt]       DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    [ExpiresAt]       DATETIME2     NOT NULL,
    [AccessCount]     INT           NOT NULL DEFAULT 0,
    [LastAccessAt]    DATETIME2     NULL,
    [IsRevoked]       BIT           NOT NULL DEFAULT 0,
    [CreatedByUserId] INT           NULL,

    INDEX [IX_Token]     UNIQUE NONCLUSTERED ([Token]),
    INDEX [IX_Mawb]      NONCLUSTERED ([MawbNumber]),
    INDEX [IX_ExpiresAt] NONCLUSTERED ([ExpiresAt])
);
```

---

## PASO 2: Crear los modelos (DTOs)

```csharp
// Models/DocumentViewerModels.cs
using System;
using System.Collections.Generic;

namespace YourProject.Models
{
    // ─── Token en base de datos ───
    public class DocumentAccessToken
    {
        public int Id { get; set; }
        public string Token { get; set; } = string.Empty;
        public string MawbNumber { get; set; } = string.Empty;
        public string AccessScope { get; set; } = "Full";
        public string? ScopeEntityName { get; set; }
        public string? ClientEmail { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public int AccessCount { get; set; }
        public DateTime? LastAccessAt { get; set; }
        public bool IsRevoked { get; set; }
        public int? CreatedByUserId { get; set; }
    }

    // ─── Resultado de validación ───
    public class TokenValidationResult
    {
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public string? MawbNumber { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public string AccessScope { get; set; } = "Full";
        public string? ScopeEntityName { get; set; }
    }

    // ─── DTOs para el componente (JSON camelCase) ───
    public class ShipmentDataDto
    {
        public string Mawb { get; set; } = string.Empty;
        public string ClientName { get; set; } = string.Empty;
        public string Origin { get; set; } = string.Empty;
        public string Destination { get; set; } = string.Empty;
        public string Status { get; set; } = "In Transit";
        public string? AgencyLogo { get; set; }
        public int? ExpirationDays { get; set; }
        public List<DocumentDto> MasterDocuments { get; set; } = new();
        public List<HawbDto> Hawbs { get; set; } = new();
    }

    public class HawbDto
    {
        public string Id { get; set; } = string.Empty;
        public string Number { get; set; } = string.Empty;
        public string Shipper { get; set; } = string.Empty;
        public string Consignee { get; set; } = string.Empty;
        public int? SortOrder { get; set; }
        public List<DocumentDto> Documents { get; set; } = new();
    }

    public class DocumentDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string? Category { get; set; }
        public string Type { get; set; } = "pdf";
        public string Size { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public int? SortOrder { get; set; }
    }

    // ─── Request de descarga (viene del frontend vía CustomEvent) ───
    // El componente SIEMPRE emite este payload para cualquier descarga
    // (individual, masiva de PDFs, masiva mixta).
    public class DownloadRequest
    {
        public List<DownloadFileInfo> Files { get; set; } = new();
        public bool AllSameType { get; set; }
        public string? FileType { get; set; } // "pdf", "xlsx", etc. o null si mixto
    }

    public class DownloadFileInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
    }
}
```

---

## PASO 3: Servicio de Tokens (con Dapper)

```csharp
// Services/DocumentTokenService.cs
using System;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using YourProject.Models;

namespace YourProject.Services
{
    public interface IDocumentTokenService
    {
        /// <summary>
        /// Crea un token con scope de acceso.
        /// accessScope: "Full" (consignatario principal - ve todo), 
        ///              "Consignee" (importador hijo - solo sus HAWBs),
        ///              "Shipper" (exportador - solo HAWBs donde es shipper)
        /// scopeEntityName: Nombre del consignee o shipper para filtrar (null para Full).
        /// </summary>
        Task<string> CreateTokenAsync(string mawbNumber, string? clientEmail, 
            string accessScope = "Full", string? scopeEntityName = null,
            int expirationDays = 15, int? createdByUserId = null);
        Task<TokenValidationResult> ValidateTokenAsync(string token);
        Task RevokeTokenAsync(string token);
        Task RevokeAllTokensForMawbAsync(string mawbNumber);
        Task<int> CleanupExpiredTokensAsync();
    }

    public class DocumentTokenService : IDocumentTokenService
    {
        private readonly string _connectionString;

        public DocumentTokenService(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? throw new InvalidOperationException("Connection string not found");
        }

        public async Task<string> CreateTokenAsync(string mawbNumber, string? clientEmail, 
            string accessScope = "Full", string? scopeEntityName = null,
            int expirationDays = 15, int? createdByUserId = null)
        {
            // Validar scope
            var validScopes = new[] { "Full", "Consignee", "Shipper" };
            if (!validScopes.Contains(accessScope))
                throw new ArgumentException($"AccessScope inválido: {accessScope}. Valores válidos: Full, Consignee, Shipper");

            if (accessScope != "Full" && string.IsNullOrWhiteSpace(scopeEntityName))
                throw new ArgumentException($"ScopeEntityName es requerido para AccessScope '{accessScope}'");

            // Generar token seguro de 32 bytes (64 caracteres hex)
            var tokenBytes = RandomNumberGenerator.GetBytes(32);
            var token = Convert.ToHexString(tokenBytes).ToLowerInvariant();

            var sql = @"
                INSERT INTO DocumentAccessTokens 
                    (Token, MawbNumber, AccessScope, ScopeEntityName, ClientEmail, ExpiresAt, CreatedByUserId)
                VALUES 
                    (@Token, @MawbNumber, @AccessScope, @ScopeEntityName, @ClientEmail, @ExpiresAt, @CreatedByUserId)";

            using var connection = new SqlConnection(_connectionString);
            await connection.ExecuteAsync(sql, new
            {
                Token = token,
                MawbNumber = mawbNumber,
                AccessScope = accessScope,
                ScopeEntityName = scopeEntityName,
                ClientEmail = clientEmail,
                ExpiresAt = DateTime.UtcNow.AddDays(expirationDays),
                CreatedByUserId = createdByUserId
            });

            return token;
        }

        public async Task<TokenValidationResult> ValidateTokenAsync(string token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length != 64)
            {
                return new TokenValidationResult 
                { 
                    IsValid = false, 
                    ErrorMessage = "Token inválido" 
                };
            }

            var sql = @"
                SELECT Id, Token, MawbNumber, AccessScope, ScopeEntityName, ExpiresAt, IsRevoked
                FROM DocumentAccessTokens
                WHERE Token = @Token";

            using var connection = new SqlConnection(_connectionString);
            var record = await connection.QueryFirstOrDefaultAsync<DocumentAccessToken>(sql, new { Token = token });

            if (record == null)
            {
                return new TokenValidationResult 
                { 
                    IsValid = false, 
                    ErrorMessage = "Token no encontrado" 
                };
            }

            if (record.IsRevoked)
            {
                return new TokenValidationResult 
                { 
                    IsValid = false, 
                    ErrorMessage = "Este enlace ha sido revocado" 
                };
            }

            if (record.ExpiresAt < DateTime.UtcNow)
            {
                return new TokenValidationResult 
                { 
                    IsValid = false, 
                    ErrorMessage = "Este enlace ha expirado" 
                };
            }

            // Actualizar contador de accesos
            var updateSql = @"
                UPDATE DocumentAccessTokens 
                SET AccessCount = AccessCount + 1, LastAccessAt = GETUTCDATE()
                WHERE Id = @Id";
            await connection.ExecuteAsync(updateSql, new { record.Id });

            return new TokenValidationResult
            {
                IsValid = true,
                MawbNumber = record.MawbNumber,
                ExpiresAt = record.ExpiresAt,
                AccessScope = record.AccessScope,
                ScopeEntityName = record.ScopeEntityName
            };
        }

        public async Task RevokeTokenAsync(string token)
        {
            var sql = "UPDATE DocumentAccessTokens SET IsRevoked = 1 WHERE Token = @Token";
            using var connection = new SqlConnection(_connectionString);
            await connection.ExecuteAsync(sql, new { Token = token });
        }

        public async Task RevokeAllTokensForMawbAsync(string mawbNumber)
        {
            // Revocar todos los tokens activos de un MAWB (útil cuando se re-envían notificaciones)
            var sql = @"UPDATE DocumentAccessTokens SET IsRevoked = 1 
                        WHERE MawbNumber = @MawbNumber AND IsRevoked = 0 AND ExpiresAt > GETUTCDATE()";
            using var connection = new SqlConnection(_connectionString);
            await connection.ExecuteAsync(sql, new { MawbNumber = mawbNumber });
        }

        public async Task<int> CleanupExpiredTokensAsync()
        {
            // Eliminar tokens expirados hace más de 30 días
            var sql = @"
                DELETE FROM DocumentAccessTokens 
                WHERE ExpiresAt < DATEADD(DAY, -30, GETUTCDATE())";
            
            using var connection = new SqlConnection(_connectionString);
            return await connection.ExecuteAsync(sql);
        }
    }
}
```

---

## PASO 4: Servicio de consulta de documentos

```csharp
// Services/ShipmentDocumentService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using YourProject.Models;

namespace YourProject.Services
{
    public interface IShipmentDocumentService
    {
        /// <summary>
        /// Obtiene datos del embarque filtrados según el scope del token.
        /// accessScope: "Full" = todo, "Consignee" = solo HAWBs de ese consignee, 
        ///              "Shipper" = solo HAWBs de ese shipper.
        /// scopeEntityName: Nombre del consignee o shipper (null para Full).
        /// </summary>
        Task<ShipmentDataDto?> GetShipmentDataAsync(string mawbNumber, 
            string accessScope = "Full", string? scopeEntityName = null);
    }

    public class ShipmentDocumentService : IShipmentDocumentService
    {
        private readonly string _connectionString;
        private readonly string _blobConnectionString;
        private readonly string _blobContainerName;
        private readonly string _agencyLogoUrl;
        private readonly int _sasTokenExpirationDays;

        public ShipmentDocumentService(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
            _blobConnectionString = configuration.GetConnectionString("AzureBlobStorage")!;
            _blobContainerName = configuration["BlobStorage:ContainerName"] ?? "documents";
            _agencyLogoUrl = configuration["Agency:LogoUrl"] ?? "";
            _sasTokenExpirationDays = configuration.GetValue<int>("BlobStorage:SasExpirationDays", 15);
        }

        public async Task<ShipmentDataDto?> GetShipmentDataAsync(string mawbNumber, 
            string accessScope = "Full", string? scopeEntityName = null)
        {
            using var connection = new SqlConnection(_connectionString);

            // 1. Obtener info del Master
            var masterSql = @"
                SELECT 
                    m.MawbNumber,
                    m.ClientName,
                    m.Origin,
                    m.Destination,
                    m.Status
                FROM Masters m
                WHERE m.MawbNumber = @MawbNumber";

            var master = await connection.QueryFirstOrDefaultAsync<dynamic>(masterSql, new { MawbNumber = mawbNumber });
            if (master == null) return null;

            // 2. Obtener documentos del Master
            //    Solo se incluyen documentos master si el scope es "Full" (consignatario principal).
            //    Importadores hijo y exportadores NO ven documentos a nivel master.
            var masterDocs = new List<dynamic>();
            if (accessScope == "Full")
            {
                var masterDocsSql = @"
                    SELECT 
                        d.Id,
                        d.FileName as Name,
                        d.DisplayName,
                        d.Category,
                        d.FileType as Type,
                        d.FileSize as Size,
                        FORMAT(d.UploadDate, 'yyyy-MM-dd') as Date,
                        d.BlobPath,
                        d.SortOrder
                    FROM Documents d
                    WHERE d.MawbNumber = @MawbNumber AND d.HawbId IS NULL
                    ORDER BY ISNULL(d.SortOrder, 9999), d.UploadDate DESC";

                masterDocs = (await connection.QueryAsync<dynamic>(masterDocsSql, new { MawbNumber = mawbNumber })).ToList();
            }

            // 3. Obtener HAWBs filtradas según el scope
            //    - Full: todas las HAWBs
            //    - Consignee: solo HAWBs donde ConsigneeName = scopeEntityName
            //    - Shipper: solo HAWBs donde ShipperName = scopeEntityName
            string hawbFilter = accessScope switch
            {
                "Consignee" => "AND h.ConsigneeName = @ScopeEntityName",
                "Shipper"   => "AND h.ShipperName = @ScopeEntityName",
                _           => "" // Full: sin filtro adicional
            };

            var hawbsSql = $@"
                SELECT 
                    h.Id,
                    h.HawbNumber as Number,
                    h.ShipperName as Shipper,
                    h.ConsigneeName as Consignee,
                    h.SortOrder
                FROM Hawbs h
                WHERE h.MawbNumber = @MawbNumber {hawbFilter}
                ORDER BY ISNULL(h.SortOrder, 9999), h.HawbNumber";

            var hawbs = (await connection.QueryAsync<dynamic>(hawbsSql, new { MawbNumber = mawbNumber, ScopeEntityName = scopeEntityName })).ToList();

            // Si no hay HAWBs visibles y no es Full, verificar que el scope sea válido
            if (hawbs.Count == 0 && accessScope != "Full")
            {
                // El usuario tiene scope restringido pero no hay HAWBs que coincidan
                return null;
            }

            // 4. Obtener documentos de esas HAWBs (solo las IDs filtradas)
            var hawbIds = hawbs.Select(h => (int)h.Id).ToList();

            var allHawbDocs = new List<dynamic>();
            if (hawbIds.Count > 0)
            {
                var hawbDocsSql = @"
                    SELECT 
                        d.Id,
                        d.HawbId,
                        d.FileName as Name,
                        d.DisplayName,
                        d.Category,
                        d.FileType as Type,
                        d.FileSize as Size,
                        FORMAT(d.UploadDate, 'yyyy-MM-dd') as Date,
                        d.BlobPath,
                        d.SortOrder
                    FROM Documents d
                    WHERE d.MawbNumber = @MawbNumber 
                      AND d.HawbId IN @HawbIds
                    ORDER BY ISNULL(d.SortOrder, 9999), d.UploadDate DESC";

                allHawbDocs = (await connection.QueryAsync<dynamic>(hawbDocsSql, 
                    new { MawbNumber = mawbNumber, HawbIds = hawbIds })).ToList();
            }

            // 5. Generar SAS URLs para todos los documentos
            var blobClient = new BlobServiceClient(_blobConnectionString);
            var containerClient = blobClient.GetBlobContainerClient(_blobContainerName);

            string GenerateSasUrl(string blobPath)
            {
                var blobClientItem = containerClient.GetBlobClient(blobPath);
                var sasBuilder = new BlobSasBuilder
                {
                    BlobContainerName = _blobContainerName,
                    BlobName = blobPath,
                    Resource = "b",
                    ExpiresOn = DateTimeOffset.UtcNow.AddDays(_sasTokenExpirationDays)
                };
                sasBuilder.SetPermissions(BlobSasPermissions.Read);
                
                var sasUri = blobClientItem.GenerateSasUri(sasBuilder);
                return sasUri.ToString();
            }

            // 6. Construir el DTO (ya viene filtrado por scope desde las queries)
            var result = new ShipmentDataDto
            {
                Mawb = master.MawbNumber,
                ClientName = master.ClientName,
                Origin = master.Origin,
                Destination = master.Destination,
                Status = master.Status,
                AgencyLogo = _agencyLogoUrl,
                ExpirationDays = _sasTokenExpirationDays,
                MasterDocuments = masterDocs.Select(d => new DocumentDto
                {
                    Id = d.Id.ToString(),
                    Name = d.Name,
                    DisplayName = d.DisplayName,
                    Category = d.Category,
                    Type = GetFileExtension(d.Type ?? d.Name),
                    Size = FormatFileSize(d.Size),
                    Date = d.Date,
                    Url = GenerateSasUrl(d.BlobPath),
                    SortOrder = (int?)d.SortOrder
                }).ToList(),
                Hawbs = hawbs.Select(h => new HawbDto
                {
                    Id = h.Id.ToString(),
                    Number = h.Number,
                    Shipper = h.Shipper,
                    Consignee = h.Consignee,
                    SortOrder = (int?)h.SortOrder,
                    Documents = allHawbDocs
                        .Where(d => d.HawbId == h.Id)
                        .Select(d => new DocumentDto
                        {
                            Id = d.Id.ToString(),
                            Name = d.Name,
                            DisplayName = d.DisplayName,
                            Category = d.Category,
                            Type = GetFileExtension(d.Type ?? d.Name),
                            Size = FormatFileSize(d.Size),
                            Date = d.Date,
                            Url = GenerateSasUrl(d.BlobPath),
                            SortOrder = (int?)d.SortOrder
                        }).ToList()
                }).ToList()
            };

            return result;
        }

        private static string GetFileExtension(string filename)
        {
            var ext = System.IO.Path.GetExtension(filename)?.ToLowerInvariant().TrimStart('.') ?? "pdf";
            return ext switch
            {
                "jpeg" => "jpg",
                _ => ext
            };
        }

        private static string FormatFileSize(long? bytes)
        {
            if (!bytes.HasValue) return "0 KB";
            
            return bytes.Value switch
            {
                < 1024 => $"{bytes} B",
                < 1024 * 1024 => $"{bytes / 1024.0:F1} KB",
                < 1024 * 1024 * 1024 => $"{bytes / (1024.0 * 1024):F1} MB",
                _ => $"{bytes / (1024.0 * 1024 * 1024):F1} GB"
            };
        }
    }
}
```

---

## PASO 5: Página Razor (sin layout)

```cshtml
@* Pages/External/DocumentViewer.cshtml *@
@page "/docs/{token}"
@model YourProject.Pages.External.DocumentViewerModel
@{
    Layout = null;
}
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no">
    <meta name="robots" content="noindex, nofollow">
    <title>@(Model.IsValid ? $"Documentos - {Model.ShipmentData?.Mawb}" : "Acceso Denegado")</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            min-height: 100vh;
        }
        .error-container {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; min-height: 100vh; padding: 2rem; text-align: center;
        }
        .error-icon { width: 80px; height: 80px; margin-bottom: 1.5rem; color: #ef4444; }
        .error-title { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin-bottom: 0.5rem; }
        .error-message { color: #64748b; max-width: 400px; }
        .loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .spinner {
            width: 40px; height: 40px; border: 3px solid #e2e8f0;
            border-top-color: #8b5cf6; border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @@keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    @if (!Model.IsValid)
    {
        <div class="error-container">
            <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <h1 class="error-title">Acceso Denegado</h1>
            <p class="error-message">@Model.ErrorMessage</p>
        </div>
    }
    else
    {
        <div id="loading" class="loading"><div class="spinner"></div></div>

        <shipping-doc-viewer id="docViewer" style="display:none;"></shipping-doc-viewer>

        <script src="~/js/shipping-doc-viewer.js"></script>
        <script>
            (function() {
                const shipmentData = @Html.Raw(
                    System.Text.Json.JsonSerializer.Serialize(
                        Model.ShipmentData,
                        new System.Text.Json.JsonSerializerOptions {
                            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
                        }));

                const viewer  = document.getElementById('docViewer');
                const loading = document.getElementById('loading');

                viewer.data = shipmentData;

                // Mostrar componente
                setTimeout(() => {
                    loading.style.display = 'none';
                    viewer.style.display  = 'block';
                }, 100);

                // ──────────────────────────────────────────────────────
                // TODA descarga (1 archivo o N) llega aquí.
                // El backend decide: proxy directo, PDF merge, o ZIP.
                // ──────────────────────────────────────────────────────
                viewer.addEventListener('download-request', async function(e) {
                    const { files, allSameType, fileType } = e.detail;

                    try {
                        const response = await fetch('/api/documents/download', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Access-Token': '@Model.Token'
                            },
                            body: JSON.stringify({ files, allSameType, fileType })
                        });

                        if (!response.ok) {
                            const err = await response.json().catch(() => null);
                            throw new Error(err?.error || 'Error al preparar la descarga');
                        }

                        // Leer content-type y content-disposition del backend
                        const contentType = response.headers.get('Content-Type') || '';
                        const disposition = response.headers.get('Content-Disposition') || '';

                        // Extraer nombre de archivo sugerido por el backend
                        let fileName = 'documento';
                        const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
                        if (match) {
                            fileName = decodeURIComponent(match[1]);
                        } else if (files.length === 1) {
                            fileName = files[0].displayName || files[0].name;
                        } else if (allSameType && fileType === 'pdf') {
                            fileName = 'documentos.pdf';
                        } else {
                            fileName = 'documentos.zip';
                        }

                        const blob = await response.blob();
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href     = url;
                        a.download = fileName;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                    } catch (error) {
                        console.error('Download error:', error);
                        alert('Error al descargar: ' + error.message);
                    }
                });
            })();
        </script>
    }
</body>
</html>
```

---

## PASO 6: Handler de la página (OnGetAsync)

```csharp
// Pages/External/DocumentViewer.cshtml.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using YourProject.Models;
using YourProject.Services;

namespace YourProject.Pages.External
{
    public class DocumentViewerModel : PageModel
    {
        private readonly IDocumentTokenService _tokenService;
        private readonly IShipmentDocumentService _documentService;

        public DocumentViewerModel(
            IDocumentTokenService tokenService,
            IShipmentDocumentService documentService)
        {
            _tokenService = tokenService;
            _documentService = documentService;
        }

        public bool IsValid { get; private set; }
        public string? ErrorMessage { get; private set; }
        public string Token { get; private set; } = string.Empty;
        public ShipmentDataDto? ShipmentData { get; private set; }

        public async Task<IActionResult> OnGetAsync(string token)
        {
            Token = token;

            // 1. Validar token
            var validation = await _tokenService.ValidateTokenAsync(token);
            if (!validation.IsValid)
            {
                IsValid = false;
                ErrorMessage = validation.ErrorMessage;
                return Page();
            }

            // 2. Obtener datos filtrados por scope
            ShipmentData = await _documentService.GetShipmentDataAsync(
                validation.MawbNumber!,
                validation.AccessScope,
                validation.ScopeEntityName);

            if (ShipmentData == null)
            {
                IsValid = false;
                ErrorMessage = "No se encontraron documentos para esta guía";
                return Page();
            }

            IsValid = true;
            return Page();
        }
    }
}
```

---

## PASO 7: API de descarga — Single / PDF Merge (Syncfusion) / ZIP mixto

> **NuGet requerido:** `Syncfusion.Pdf.Net.Core` (licencia Community gratis hasta 25 devs)
>
> Este controller maneja los 3 escenarios de descarga:
> 1. **1 archivo** → proxy directo con content-type real
> 2. **N archivos del mismo tipo PDF** → merge con Syncfusion en 1 solo PDF
> 3. **N archivos de tipos mixtos** → ZipArchive

```csharp
// Controllers/DocumentsController.cs
using Microsoft.AspNetCore.Mvc;
using System.IO.Compression;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Parsing;
using YourProject.Models;
using YourProject.Services;

namespace YourProject.Controllers
{
    [ApiController]
    [Route("api/documents")]
    public class DocumentsController : ControllerBase
    {
        private readonly IDocumentTokenService _tokenService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<DocumentsController> _logger;

        public DocumentsController(
            IDocumentTokenService tokenService,
            IHttpClientFactory httpClientFactory,
            ILogger<DocumentsController> logger)
        {
            _tokenService = tokenService;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        /// <summary>
        /// Endpoint único de descarga. El componente frontend SIEMPRE llama aquí.
        /// Decide automáticamente: proxy directo, PDF merge, o ZIP.
        /// </summary>
        [HttpPost("download")]
        public async Task<IActionResult> Download(
            [FromBody] DownloadRequest request,
            [FromHeader(Name = "X-Access-Token")] string token)
        {
            // ── 1. Validar token ──
            var validation = await _tokenService.ValidateTokenAsync(token);
            if (!validation.IsValid)
                return Unauthorized(new { error = validation.ErrorMessage });

            if (request.Files == null || request.Files.Count == 0)
                return BadRequest(new { error = "No files specified" });

            // ── 2. SEGURIDAD: Validar que los IDs pedidos pertenecen al scope del token ──
            // TODO: Implementar validación contra BD.
            // Ejemplo: obtener IDs permitidos para este MAWB+scope y comparar.
            // var allowedIds = await GetAllowedDocumentIds(validation.MawbNumber, validation.AccessScope, validation.ScopeEntityName);
            // var requestedIds = request.Files.Select(f => f.Id).ToHashSet();
            // if (!requestedIds.IsSubsetOf(allowedIds))
            //     return Forbid();

            var httpClient = _httpClientFactory.CreateClient();

            // ── 3. Descargar todos los archivos de Azure Blob ──
            var downloadedFiles = new List<(string Name, string Type, byte[] Bytes)>();
            foreach (var file in request.Files)
            {
                try
                {
                    var bytes = await httpClient.GetByteArrayAsync(file.Url);
                    var name = !string.IsNullOrEmpty(file.DisplayName)
                        ? $"{file.DisplayName}.{file.Type}"
                        : file.Name;
                    downloadedFiles.Add((name, file.Type.ToLowerInvariant(), bytes));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error descargando archivo {Name} ({Id})", file.Name, file.Id);
                    // Continuar con los demás archivos
                }
            }

            if (downloadedFiles.Count == 0)
                return StatusCode(502, new { error = "No se pudo descargar ningún archivo" });

            // ── 4. Decidir estrategia de respuesta ──

            // CASO A: 1 solo archivo → proxy directo
            if (downloadedFiles.Count == 1)
            {
                var (name, type, bytes) = downloadedFiles[0];
                var contentType = GetContentType(type);
                return File(bytes, contentType, name);
            }

            // CASO B: Todos son PDF → merge con Syncfusion
            if (request.AllSameType && request.FileType == "pdf")
            {
                return MergePdfs(downloadedFiles);
            }

            // CASO C: Tipos mixtos → ZIP
            return CreateZip(downloadedFiles);
        }

        // ─────────────────────────────────────────────────
        // MERGE PDFs con Syncfusion
        // ─────────────────────────────────────────────────
        private IActionResult MergePdfs(List<(string Name, string Type, byte[] Bytes)> files)
        {
            using var finalDocument = new PdfDocument();

            foreach (var (name, type, bytes) in files)
            {
                try
                {
                    using var stream = new MemoryStream(bytes);
                    using var source = new PdfLoadedDocument(stream);
                    PdfDocumentBase.Merge(finalDocument, source);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error merging PDF: {Name}", name);
                    // Omitir este PDF y continuar con los demás
                }
            }

            if (finalDocument.Pages.Count == 0)
                return StatusCode(500, new { error = "No se pudo generar el PDF combinado" });

            using var outputStream = new MemoryStream();
            finalDocument.Save(outputStream);
            outputStream.Position = 0;

            return File(
                outputStream.ToArray(),
                "application/pdf",
                "documentos.pdf");
        }

        // ─────────────────────────────────────────────────
        // ZIP para tipos mixtos
        // ─────────────────────────────────────────────────
        private IActionResult CreateZip(List<(string Name, string Type, byte[] Bytes)> files)
        {
            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, leaveOpen: true))
            {
                var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var (name, type, bytes) in files)
                {
                    // Asegurar nombres únicos en el ZIP
                    var finalName = name;
                    var counter = 1;
                    while (!usedNames.Add(finalName))
                    {
                        var ext = Path.GetExtension(name);
                        var baseName = Path.GetFileNameWithoutExtension(name);
                        finalName = $"{baseName}_{counter}{ext}";
                        counter++;
                    }

                    var entry = archive.CreateEntry(finalName, CompressionLevel.Optimal);
                    using var entryStream = entry.Open();
                    entryStream.Write(bytes, 0, bytes.Length);
                }
            }

            memoryStream.Position = 0;
            return File(
                memoryStream.ToArray(),
                "application/zip",
                "documentos.zip");
        }

        // ─────────────────────────────────────────────────
        // Content-Type mapper
        // ─────────────────────────────────────────────────
        private static string GetContentType(string fileType) => fileType switch
        {
            "pdf"  => "application/pdf",
            "xls"  => "application/vnd.ms-excel",
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "doc"  => "application/msword",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "jpg"  => "image/jpeg",
            "jpeg" => "image/jpeg",
            "png"  => "image/png",
            _      => "application/octet-stream"
        };
    }
}
```

---

## PASO 8: Registrar servicios en Program.cs

```csharp
// Program.cs

// Servicios de negocio
builder.Services.AddScoped<IDocumentTokenService, DocumentTokenService>();
builder.Services.AddScoped<IShipmentDocumentService, ShipmentDocumentService>();

// HttpClient para descargar archivos desde Azure Blob en el handler de descarga
builder.Services.AddHttpClient();

// Azure Blob Storage
builder.Services.AddSingleton(x =>
    new Azure.Storage.Blobs.BlobServiceClient(
        builder.Configuration.GetConnectionString("AzureBlobStorage")));

// API Controllers (requerido para DocumentsController)
builder.Services.AddControllers();

// --- En el pipeline (después de var app = builder.Build()) ---
app.MapControllers();  // Mapea /api/documents/download
```

---

## PASO 9: Configuración en appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=...;",
    "AzureBlobStorage": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;"
  },
  "BlobStorage": {
    "ContainerName": "documents",
    "SasExpirationDays": 15
  },
  "Agency": {
    "LogoUrl": "https://avcoperflor.blob.core.windows.net/operflorimg/operflorlogo.png"
  },
  "App": {
    "BaseUrl": "https://tudominio.com"
  }
}
```

---

## PASO 10: NuGet packages necesarios

```xml
<!-- En tu .csproj, agregar: -->
<ItemGroup>
    <PackageReference Include="Dapper" Version="2.*" />
    <PackageReference Include="Microsoft.Data.SqlClient" Version="5.*" />
    <PackageReference Include="Azure.Storage.Blobs" Version="12.*" />
    <PackageReference Include="Syncfusion.Pdf.Net.Core" Version="*" />
</ItemGroup>
```

> **Syncfusion Community License:** gratis para empresas con menos de $1M en ingresos anuales
> y menos de 5 desarrolladores. Registrarse en https://www.syncfusion.com/products/communitylicense
> y agregar la licencia en `Program.cs`:
> ```csharp
> Syncfusion.Licensing.SyncfusionLicenseProvider.RegisterLicense("TU-CLAVE-AQUI");
> ```

---

## PASO 11: Copiar el componente compilado

Después de ejecutar `npm run build` en el proyecto del componente:

```powershell
# Desde la raíz del proyecto del componente:
Copy-Item .\dist\shipping-doc-viewer.js C:\ruta\a\tu\RazorProject\wwwroot\js\shipping-doc-viewer.js
```

El archivo `shipping-doc-viewer.js` es un IIFE autocontenido (61 kB / 18 kB gzip).
Incluye Preact, Tailwind CSS, iconos Lucide y la fuente Inter. Todo dentro de Shadow DOM.
No necesita ningún otro archivo CSS o JS.

---

## PASO 12: Generar y enviar links según modo de notificación

Existen **3 modos de notificación**, cada uno genera tokens con distinto scope de acceso:

### Modo 1: Consignatario principal (Full) — Ve TODOS los documentos

```csharp
public async Task NotifyConsigneeFullAccess(string mawbNumber, List<string> consigneeEmails)
{
    var baseUrl = _configuration["App:BaseUrl"];

    foreach (var email in consigneeEmails)
    {
        var token = await _tokenService.CreateTokenAsync(
            mawbNumber,
            clientEmail: email,
            accessScope: "Full",
            scopeEntityName: null,
            expirationDays: 15);

        var link = $"{baseUrl}/docs/{token}";
        await _emailService.SendAsync(to: email,
            subject: $"Documentos disponibles - {mawbNumber}",
            body: $"<p>Los documentos de la guía {mawbNumber} están disponibles.</p><p><a href='{link}'>Ver documentos</a></p>");
    }
}
```

### Modo 2: Importador hijo (Consignee) — Solo sus HAWBs

```csharp
public async Task NotifyChildImporters(string mawbNumber, List<HawbImporterInfo> importers)
{
    var baseUrl = _configuration["App:BaseUrl"];

    foreach (var importer in importers)
    {
        foreach (var email in importer.Emails)
        {
            var token = await _tokenService.CreateTokenAsync(
                mawbNumber,
                clientEmail: email,
                accessScope: "Consignee",
                scopeEntityName: importer.ConsigneeName,
                expirationDays: 15);

            var link = $"{baseUrl}/docs/{token}";
            await _emailService.SendAsync(to: email,
                subject: $"Documentos de su embarque - {mawbNumber}",
                body: $"<p>Sus documentos bajo la guía {mawbNumber} están disponibles.</p><p><a href='{link}'>Ver documentos</a></p>");
        }
    }
}

public class HawbImporterInfo
{
    public string ConsigneeName { get; set; } = string.Empty;
    public List<string> Emails { get; set; } = new();
}
```

### Modo 3: Exportador (Shipper) — Solo HAWBs donde es shipper

```csharp
public async Task NotifyExporters(string mawbNumber, List<ShipperInfo> shippers)
{
    var baseUrl = _configuration["App:BaseUrl"];

    foreach (var shipper in shippers)
    {
        foreach (var email in shipper.Emails)
        {
            var token = await _tokenService.CreateTokenAsync(
                mawbNumber,
                clientEmail: email,
                accessScope: "Shipper",
                scopeEntityName: shipper.ShipperName,
                expirationDays: 15);

            var link = $"{baseUrl}/docs/{token}";
            await _emailService.SendAsync(to: email,
                subject: $"Documentos de exportación - {mawbNumber}",
                body: $"<p>Sus documentos de exportación bajo la guía {mawbNumber} están disponibles.</p><p><a href='{link}'>Ver documentos</a></p>");
        }
    }
}

public class ShipperInfo
{
    public string ShipperName { get; set; } = string.Empty;
    public List<string> Emails { get; set; } = new();
}
```

---

## Contrato Completo: Frontend ↔ Backend

### A. Evento que emite el componente

El componente `<shipping-doc-viewer>` emite un `CustomEvent` llamado `download-request`
en **toda** acción de descarga (individual o masiva). Nunca descarga directo al navegador.

```typescript
// Payload del CustomEvent (e.detail):
interface DownloadRequestEvent {
  files: {
    id: string;        // ID del documento en BD
    name: string;      // Nombre original del archivo
    displayName?: string; // Nombre amigable (puede ser undefined)
    type: string;      // "pdf" | "xls" | "xlsx" | "jpg" | "png" | "doc" | "docx"
    url: string;       // SAS URL de Azure Blob
  }[];
  allSameType: boolean; // true si TODOS los files tienen el mismo type
  fileType: string | null; // El type común si allSameType=true, null si mixto
}
```

### B. Request HTTP que hace el listener JS

```
POST /api/documents/download
Content-Type: application/json
X-Access-Token: {token_del_url}

{
  "files": [ { "id": "m1", "name": "MAWB.pdf", "type": "pdf", "url": "https://..." } ],
  "allSameType": true,
  "fileType": "pdf"
}
```

### C. Respuestas del backend

| Escenario | Content-Type | Filename | Lógica |
|-----------|-------------|----------|--------|
| 1 archivo cualquiera | El real del archivo (pdf, jpg, xlsx...) | Nombre del archivo | Proxy directo de bytes |
| N archivos, todos PDF | `application/pdf` | `documentos.pdf` | Syncfusion `PdfDocumentBase.Merge` |
| N archivos, tipos mixtos | `application/zip` | `documentos.zip` | `ZipArchive` con nombres únicos |

### D. Datos que alimentan al componente

```
GET /docs/{token}
```

El handler `OnGetAsync` valida el token y serializa `ShipmentDataDto` como JSON camelCase
directamente en el HTML vía `@Html.Raw(...)`. El JS lo asigna a `viewer.data = shipmentData`.

```typescript
// Contrato ShipmentData (lo que recibe el componente):
interface ShipmentData {
  mawb: string;                    // "020-8901-2345"
  clientName: string;              // "JAF FLOWER SA"
  origin: string;                  // "HKG"
  destination: string;             // "LAX"
  status: "In Transit" | "Cleared" | "Delivered" | "Exception";
  agencyLogo?: string;             // URL de imagen del logo
  expirationDays?: number;         // Días hasta expiración (default 15)
  masterDocuments: Document[];     // Docs a nivel master (vacío si scope != Full)
  hawbs: HAWB[];                   // HAWBs filtradas por scope
}

interface HAWB {
  id: string;
  number: string;       // "H-100234"
  shipper: string;      // Exportador
  consignee: string;    // Importador
  sortOrder?: number;
  documents: Document[];
}

interface Document {
  id: string;
  name: string;            // "Commercial_Invoice_INV9901.pdf"
  displayName?: string;    // "Commercial Invoice"
  category?: string;       // "Invoice"
  type: "pdf" | "xls" | "xlsx" | "jpg" | "png" | "doc" | "docx";
  size: string;            // "240 KB"
  date: string;            // "2023-10-22"
  url: string;             // SAS URL de Azure Blob
  sortOrder?: number;      // Orden de display (menor = primero)
}
```

---

## Matriz de visibilidad por scope

| Scope | Master Docs | HAWBs visibles | Documentos HAWB |
|-------|-----------|---------------|----------------|
| **Full** (consignatario principal) | Todos | Todas | Todos |
| **Consignee** (importador hijo) | Ninguno | Solo donde él es consignee | Todos de esas HAWBs |
| **Shipper** (exportador) | Ninguno | Solo donde él es shipper | Todos de esas HAWBs |

---

## Flujo de descarga paso a paso (para el agente de VS2022)

```
1. Usuario abre https://tudominio.com/docs/abc123def456...
   │
2. DocumentViewerModel.OnGetAsync(token)
   ├─ Valida token en tabla DocumentAccessTokens
   ├─ Extrae: MawbNumber, AccessScope, ScopeEntityName
   ├─ Llama ShipmentDocumentService.GetShipmentDataAsync(mawb, scope, entity)
   │   ├─ Query Masters → info general
   │   ├─ Query Documents WHERE HawbId IS NULL → master docs (solo si scope=Full)
   │   ├─ Query Hawbs con filtro de scope → HAWBs permitidas
   │   ├─ Query Documents WHERE HawbId IN @filteredIds → docs de esas HAWBs
   │   └─ Genera SAS URL por cada documento
   └─ Serializa ShipmentDataDto como JSON camelCase en el HTML
   │
3. Browser carga shipping-doc-viewer.js
   ├─ Custom element <shipping-doc-viewer> se registra
   ├─ viewer.data = shipmentData (asigna el JSON)
   └─ Preact renderiza dentro de Shadow DOM
   │
4. Usuario hace clic en descargar (cualquier botón)
   ├─ Fila individual → handleSingleDownload(doc) → emitDownloadEvent([doc])
   └─ "Download All" o "Download (N)" → handleBulkDownload() → emitDownloadEvent(docs)
   │
5. emitDownloadEvent construye payload:
   │  { files: [...], allSameType: bool, fileType: string|null }
   └─ Emite CustomEvent 'download-request' (bubbles + composed)
   │
6. Listener JS en DocumentViewer.cshtml captura el evento
   └─ fetch POST /api/documents/download
      ├─ Headers: Content-Type: application/json, X-Access-Token: {token}
      └─ Body: el payload del evento
   │
7. DocumentsController.Download(request, token)
   ├─ Valida token (de nuevo, por seguridad del endpoint)
   ├─ TODO: Valida IDs contra scope del token en BD
   ├─ Descarga bytes de cada archivo desde Azure Blob vía HttpClient
   └─ Decide respuesta:
      ├─ 1 archivo → File(bytes, contentType, filename)
      ├─ N PDFs   → Syncfusion PdfDocumentBase.Merge → File(mergedPdf, "application/pdf", "documentos.pdf")
      └─ Mixtos   → ZipArchive con nombres únicos → File(zip, "application/zip", "documentos.zip")
   │
8. Listener JS recibe la respuesta
   ├─ Lee Content-Disposition para el nombre de archivo
   ├─ Crea blob URL temporal
   ├─ Crea <a download="nombre"> y dispara click
   └─ Limpia blob URL
   │
9. Browser descarga el archivo al dispositivo del usuario ✓
```

---

## Checklist de implementación para el agente de VS2022

- [ ] Crear tabla `DocumentAccessTokens` en SQL Server (PASO 1)
- [ ] Crear `Models/DocumentViewerModels.cs` con todos los DTOs (PASO 2)
- [ ] Crear `Services/DocumentTokenService.cs` con Dapper (PASO 3)
- [ ] Crear `Services/ShipmentDocumentService.cs` con queries y SAS (PASO 4)
- [ ] Crear `Pages/External/DocumentViewer.cshtml` sin layout (PASO 5)
- [ ] Crear `Pages/External/DocumentViewer.cshtml.cs` handler (PASO 6)
- [ ] Crear `Controllers/DocumentsController.cs` con merge PDF + ZIP (PASO 7)
- [ ] Registrar servicios en `Program.cs` (PASO 8)
- [ ] Agregar configuración en `appsettings.json` (PASO 9)
- [ ] Instalar NuGet packages (PASO 10)
- [ ] Copiar `shipping-doc-viewer.js` a `wwwroot/js/` (PASO 11)
- [ ] Registrar licencia Syncfusion en `Program.cs` (PASO 10, nota)
- [ ] Implementar validación de IDs contra scope en `DocumentsController` (TODO en PASO 7)
- [ ] Implementar servicio de email para notificaciones (PASO 12)
- [ ] Probar los 3 escenarios de descarga: single, PDF merge, ZIP mixto
