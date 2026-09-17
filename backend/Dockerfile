# Build context = backend/ (Render "Root Directory" setting).
# Multi-stage: SDK image restores + publishes, then a lean ASP.NET runtime image runs it.

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy just the project files first so `dotnet restore` is cached across builds
# that only change source code.
COPY src/WeddingPlanner.Api/WeddingPlanner.Api.csproj src/WeddingPlanner.Api/
COPY src/WeddingPlanner.Domain/WeddingPlanner.Domain.csproj src/WeddingPlanner.Domain/
COPY src/WeddingPlanner.Infrastructure/WeddingPlanner.Infrastructure.csproj src/WeddingPlanner.Infrastructure/
RUN dotnet restore src/WeddingPlanner.Api/WeddingPlanner.Api.csproj

COPY . .
RUN dotnet publish src/WeddingPlanner.Api/WeddingPlanner.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .

EXPOSE 8080

# Render assigns a container port via $PORT (default 10000) at runtime, not build
# time, so Kestrel's bind address has to be resolved in the shell, not baked in.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} exec dotnet WeddingPlanner.Api.dll"]
