using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Ipsum.Infrastructure.Identity;
using Microsoft.IdentityModel.Tokens;

namespace Ipsum.Api.Auth;

/// <summary>Issues signed JWTs carrying the user's id, email, roles, and (for vendors) vendorId.</summary>
public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    public string Create(AppUser user, IList<string> roles)
    {
        var keyValue = _config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyValue)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.NameIdentifier, user.Id),
        };
        if (user.VendorId is int vendorId)
            claims.Add(new Claim("vendorId", vendorId.ToString()));
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var hours = double.TryParse(_config["Jwt:ExpireHours"], out var h) ? h : 72;
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(hours),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
