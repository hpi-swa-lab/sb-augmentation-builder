#version 450

uniform mat4 transformMatrix;

in vec3 inPosition;
in vec3 inNormal;

out vec3 fragNormal;
out vec3 fragPosition;

void main() {
    mat2 rotation2D = mat2(0.866, -0.5, 0.5, 0.866);
    float d = 0.1;
    vec3 offset = mix(vec3(1.0, 0.0, 0.0), vec3(0.3, 0.5, 0.2), d);

    vec4 worldPosition = transformMatrix * vec4(inPosition + offset, 1.0);
    gl_Position = worldPosition;

    fragNormal = (transformMatrix * vec4(inNormal.xy * rotation2D, inNormal.z, 0.0)).xyz;
    fragPosition = worldPosition.xyz;
}
