FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["OpenFatoAI.Api/OpenFatoAI.Api.csproj",                       "OpenFatoAI.Api/"]
COPY ["OpenFatoAI.Domain/OpenFatoAI.Domain.csproj",                 "OpenFatoAI.Domain/"]
COPY ["OpenFatoAI.Infrastructure/OpenFatoAI.Infrastructure.csproj", "OpenFatoAI.Infrastructure/"]
RUN dotnet restore "OpenFatoAI.Api/OpenFatoAI.Api.csproj"
COPY . .
WORKDIR "/src/OpenFatoAI.Api"
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
USER appuser
ENTRYPOINT ["dotnet", "OpenFatoAI.Api.dll"]
